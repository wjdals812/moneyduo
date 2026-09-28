import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import coupleService from "../services/coupleService";
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import MonthNavigator from "../components/MonthNavigator";
import type { Transaction } from "../types/index";
import { paidByLabel } from "../types/index";
import { theme } from "../theme";

// ─────────────────────────────────────────────
// 📅 월(month) 포맷팅 헬퍼 함수
// 예: new Date(2024, 5) → "2024-06"
// ─────────────────────────────────────────────
const formatMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

// ─────────────────────────────────────────────
// 📅 날짜별로 거래 내역을 묶어주는 함수
// 예: [{ date: "2024-06-01", ... }, { date: "2024-06-01", ... }, { date: "2024-06-02", ... }]
//  → Map { "2024-06-01" => [...], "2024-06-02" => [...] }
// ─────────────────────────────────────────────
const groupByDate = (transactions: Transaction[]) => {
  const map = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const list = map.get(tx.date) ?? [];
    list.push(tx);
    map.set(tx.date, list);
  }
  return Array.from(map.entries());
};

// ─────────────────────────────────────────────
// 📅 "2024-06-01" 형식의 날짜 문자열을 "6월 1일 (토)" 형식으로 변환
// ─────────────────────────────────────────────
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

const HomePage = () => {
  const navigate = useNavigate();

  // ── 상태 선언 ──────────────────────────────
  const [, setUserName] = useState("");                        // 로그인한 유저 이름 (UI에 직접 표시 안 함)
  const [showCoupleModal, setShowCoupleModal] = useState(false); // 커플 연결 모달 표시 여부
  const [inviteCode, setInviteCode] = useState("");            // 내가 생성한 초대 코드
  const [inputCode, setInputCode] = useState("");              // 파트너 초대 코드 입력값
  const [isCreating, setIsCreating] = useState(false);         // 초대 코드 생성 중 로딩 상태
  const [, setCoupleInfo] = useState<any>(null);               // 커플 문서 데이터 (파트너 감지용)
  const [partnerName, setPartnerName] = useState("");          // 파트너 이름 (헤더에 표시)
  const [transactions, setTransactions] = useState<Transaction[]>([]); // 거래 내역 목록
  const [totalExpense, setTotalExpense] = useState(0);         // 총 지출 합계
  const [totalIncome, setTotalIncome] = useState(0);           // 총 수입 합계
  const [loading, setLoading] = useState(true);                // Firebase 인증 응답 대기 중 여부
                                                               // (true일 때 로딩 화면 표시 → flash 방지)
  const [month, setMonth] = useState<Date>(new Date());

  // ── Refs ───────────────────────────────────
  // 커플 문서 실시간 리스너의 해제 함수를 저장
  // useRef를 쓰는 이유: 리렌더링 없이 최신 값 유지 + cleanup 함수 외부 접근 가능
  const coupleUnsubRef = useRef<(() => void) | null>(null);
  // 가장 최근에 요청된 monthKey를 추적 (오래된 fetch가 늦게 도착해서 최신 월을 덮어쓰는 것 방지)
  const latestMonthKeyRef = useRef("");

  // ─────────────────────────────────────────────
  // 💾 거래 내역을 조회하고 월별로 필터링하는 함수
  // - 커플 내역 + 개인 내역 병렬 조회
  // - 중복 제거 후 월 필터 적용
  // ─────────────────────────────────────────────
  const loadTransactions = async (userId: string, monthKey: string) => {
    latestMonthKeyRef.current = monthKey;
    try {
      const myCouple = await coupleService.getMyCouple(userId);

      let txData: Transaction[] = [];

      if (myCouple && myCouple.members.length >= 2) {
        setCoupleInfo(myCouple);
        setInviteCode(myCouple.inviteCode ?? "");
        attachCoupleListener(myCouple.id, userId);

        const [coupleSnap, soloSnap] = await Promise.all([
          getDocs(query(
            collection(db, "transactions"),
            where("coupleId", "==", myCouple.id),
            orderBy("date", "desc"), limit(300)
          )),
          getDocs(query(
            collection(db, "transactions"),
            where("createdBy", "==", userId),
            orderBy("date", "desc"), limit(300)
          )),
        ]);

        const allDocs = [...coupleSnap.docs, ...soloSnap.docs];
        const seen = new Set();
        txData = allDocs
          .filter(d => {
            if (seen.has(d.id)) return false;
            seen.add(d.id);
            return true;
          })
          .map(d => ({ id: d.id, ...d.data() })) as Transaction[];

        txData.sort((a, b) => b.date.localeCompare(a.date));

      } else {
        const soloQ = query(
          collection(db, "transactions"),
          where("createdBy", "==", userId),
          orderBy("date", "desc"),
          limit(300)
        );
        const soloSnap = await getDocs(soloQ);
        txData = soloSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Transaction[];
      }

      // 선택한 달의 내역만 필터링
      txData = txData.filter((t) => t.date.startsWith(monthKey));

      // 이 fetch를 시작한 뒤 더 최신 월 요청이 들어왔다면 결과를 버림 (stale 데이터 방지)
      if (latestMonthKeyRef.current !== monthKey) return;

      setTransactions(txData);
      setTotalExpense(txData.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0));
      setTotalIncome(txData.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0));
    } catch (e) {
      console.error(e);
    }
  };

  // ─────────────────────────────────────────────
  // 🔗 커플 문서에 실시간 리스너를 붙이는 헬퍼 함수
  // - 파트너가 참여하면 즉시 감지해서 partnerName 업데이트
  // - 중복 리스너 방지를 위해 기존 리스너를 먼저 해제하고 새로 붙임
  // ─────────────────────────────────────────────
  const attachCoupleListener = (coupleId: string, currentUid: string) => {
    // 기존에 붙어있던 리스너가 있으면 먼저 해제
    if (coupleUnsubRef.current) {
      coupleUnsubRef.current();
      coupleUnsubRef.current = null;
    }

    // 새 리스너 등록: 커플 문서가 변경될 때마다 콜백 실행
    coupleUnsubRef.current = coupleService.listenToCouple(coupleId, async (data) => {
      setCoupleInfo(data);

      // 커플 문서가 삭제됐거나 null이면 파트너 정보 초기화
      if (!data) {
        setPartnerName("");
        setInviteCode("");
        return;
      }

      setInviteCode(data.inviteCode ?? "");

      // members 배열에서 나 자신을 제외한 uid = 파트너 uid
      const members: string[] = data.members ?? [];
      const partnerUid = members.find((m) => m !== currentUid);

      if (partnerUid) {
        // 파트너 uid로 Firestore users 컬렉션에서 이름/이모지 조회
        const userSnap = await getDoc(doc(db, "users", partnerUid));
        const p = userSnap.exists() ? (userSnap.data() as any) : null;
        setPartnerName(p?.displayName || "");
      } else {
        // 아직 파트너가 참여하지 않은 상태
        setPartnerName("");
      }
    });
  };

  // ─────────────────────────────────────────────
  // 🔥 컴포넌트 마운트 시 Firebase 인증 상태 감지 + 데이터 로딩
  // ─────────────────────────────────────────────
  useEffect(() => {
    // onAuthStateChanged: Firebase 인증 상태가 바뀔 때마다 콜백 실행
    // - 앱 첫 로드 시 로그인 여부 확인
    // - 로그인/로그아웃 시 자동 호출
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // ── 로그인된 상태 ──
        setUserName(user.displayName || "");
        await loadTransactions(user.uid, formatMonthKey(month));

      } else {
        // ── 비로그인 상태 → 로그인 페이지로 이동 ──
        navigate("/");
      }

      // Firebase 응답이 완료됐으므로 로딩 종료 (에러가 나도 항상 실행되어야 함)
      setLoading(false);
    });

    // 컴포넌트 언마운트 시 cleanup
    // - 커플 실시간 리스너 해제
    // - onAuthStateChanged 리스너 해제
    return () => {
      if (coupleUnsubRef.current) coupleUnsubRef.current();
      unsubscribe();
    };
  }, [navigate, month]);

  // ─────────────────────────────────────────────
  // ⏳ Firebase 인증 응답 대기 중 로딩 화면
  // loading이 true인 동안 빈 화면 대신 표시 → "아직 내역이 없어요" flash 방지
  // ─────────────────────────────────────────────
  if (loading) return (
    <div style={{
      minHeight: "100svh",
      background: theme.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ fontSize: "13px", fontWeight: 600, color: theme.textMuted }}>불러오는 중…</div>
    </div>
  );

  // 순액 = 수입 - 지출
  const net = totalIncome - totalExpense;
  // 날짜별로 그룹핑된 내역 (타임라인 렌더링용)
  const grouped = groupByDate(transactions);

  return (
    <div style={{
      minHeight: "100svh",
      background: theme.bg,
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "180px",
      position: "relative",
    }}>

      {/* ── 헤더 ───────────────────────────────
          - 앱 타이틀
          - 파트너 연결 상태에 따라 "커플 연결" 버튼 or "OO님과 연결됨 + 연결 해제" 버튼 표시
      ─────────────────────────────────────── */}
      <div style={{
        background: theme.surface,
        padding: "20px",
        borderBottom: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: theme.text }}>MoneyDuo</div>
            <div style={{ fontSize: "12px", fontWeight: 500, color: theme.textMuted }}>우리 둘의 재정 현황</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {partnerName ? (
              /* 파트너가 있는 경우: 이름 + 연결 해제 버튼 */
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted }}>{partnerName}님과 연결됨</div>
                <button
                  onClick={async () => {
                    if (!auth.currentUser) return;
                    const ok = confirm("커플 연결을 해제하시겠어요?");
                    if (!ok) return;
                    try {
                      await coupleService.leaveCouple(auth.currentUser.uid);
                      // 상태 초기화
                      setPartnerName("");
                      setCoupleInfo(null);
                      setInviteCode("");
                      // 실시간 리스너도 해제
                      if (coupleUnsubRef.current) {
                        coupleUnsubRef.current();
                        coupleUnsubRef.current = null;
                      }
                      alert("연결 해제되었습니다.");
                    } catch (e: any) {
                      alert(e.message || String(e));
                    }
                  }}
                  style={{
                    padding: "6px 10px", background: theme.surfaceMuted,
                    border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm,
                    cursor: "pointer", fontWeight: 600, fontSize: "11px", color: theme.textMuted,
                  }}
                >
                  연결 해제
                </button>
              </>
            ) : (
              /* 파트너가 없는 경우: 커플 연결 모달 열기 버튼 */
              <button
                onClick={() => setShowCoupleModal(true)}
                style={{
                  padding: "8px 12px",
                  background: theme.accent,
                  border: "none",
                  color: "white",
                  borderRadius: theme.radiusSm,
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                커플 연결
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 월 이동 ───────────────────────────── */}
      <div style={{ margin: "16px 16px 0" }}>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      {/* ── 타임라인 ────────────────────────────
          날짜별로 묶인 거래 내역을 세로로 나열
          내역이 없으면 빈 상태 안내 표시
      ─────────────────────────────────────── */}
      <div style={{ padding: "16px 16px 0" }}>
        {/* ── 요약 카드 ───────────────────────────
            수입 / 지출 / 순액을 3등분 그리드로 표시
        ─────────────────────────────────────── */}
        <div style={{
          marginBottom: "16px",
          background: theme.surface,
          borderRadius: theme.radiusMd,
          border: `1px solid ${theme.border}`,
          overflow: "hidden",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
            {[
              { label: "수입", value: `+${totalIncome.toLocaleString()}`, color: theme.success },
              { label: "지출", value: `-${totalExpense.toLocaleString()}`, color: theme.danger },
              { label: "순액", value: `${net >= 0 ? "+" : ""}${net.toLocaleString()}`, color: net >= 0 ? theme.text : theme.danger },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "12px 4px",
                borderRight: i < 2 ? `1px solid ${theme.border}` : "none",
              }}>
                <span style={{ fontSize: "11px", color: theme.textMuted, fontWeight: 600, marginBottom: "4px" }}>
                  {item.label}
                </span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: item.color, fontVariantNumeric: "tabular-nums" }}>
                  {item.value}
                </span>
                <span style={{ fontSize: "10px", fontWeight: 500, color: theme.textFaint, marginTop: "1px" }}>원</span>
              </div>
            ))}
          </div>
        </div>

        {grouped.length === 0 ? (
          /* 내역 없음 상태 */
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: "13px", color: theme.textMuted, fontWeight: 600 }}>이 달은 아직 내역이 없어요</div>
            <div style={{ fontSize: "11px", color: theme.textFaint, marginTop: 4 }}>첫 번째 내역을 추가해보세요</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {grouped.map(([date, txs]) => {
              // 해당 날짜의 순액 계산
              const dayNet =
                txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) -
                txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
              return (
                <div key={date}>
                  {/* 날짜 헤더 행 */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    marginBottom: "10px",
                  }}>
                    <div style={{
                      color: theme.textMuted,
                      fontSize: "11px", fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>
                      {formatDate(date)}
                    </div>
                    <div style={{ flex: 1, height: "1px", background: theme.border }} />
                    {/* 해당 날짜 순액 (양수면 초록, 음수면 빨강) */}
                    <span style={{
                      fontSize: "11px", fontWeight: 600,
                      color: dayNet >= 0 ? theme.success : theme.danger,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {dayNet >= 0 ? "+" : ""}{dayNet.toLocaleString()}원
                    </span>
                  </div>

                  {/* 해당 날짜의 거래 목록 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {txs.map((tx) => (
                      <div
                        key={tx.id}
                        style={{
                          background: theme.surface,
                          borderRadius: theme.radiusMd,
                          border: `1px solid ${theme.border}`,
                          padding: "12px 14px",
                          display: "flex", alignItems: "center", gap: "12px",
                        }}
                      >
                        {/* 카테고리 표시 */}
                        <div style={{
                          fontSize: "18px", flexShrink: 0, width: "24px", textAlign: "center",
                        }}>
                          {tx.category.split(" ")[0]} {/* 카테고리 첫 번째 토큰 (사용자 입력 이모지) */}
                        </div>

                        {/* 내역 설명 + 결제자 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: "13px", fontWeight: 600,
                            color: theme.text, whiteSpace: "nowrap",
                            overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {tx.description}
                          </div>
                          <div style={{ fontSize: "11px", fontWeight: 500, color: theme.textMuted, marginTop: "2px" }}>
                            {paidByLabel(tx, auth.currentUser?.uid)}
                          </div>
                        </div>

                        {/* 금액 (지출: 빨강, 수입: 초록) */}
                        <div style={{
                          fontSize: "13px", fontWeight: 700,
                          color: tx.type === "expense" ? theme.danger : theme.success,
                          whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
                        }}>
                          {tx.type === "expense" ? "-" : "+"}{tx.amount.toLocaleString()}원
                        </div>

                        {/* 수정 버튼 → /edit/:id 페이지로 이동 */}
                        <button
                          onClick={() => navigate(`/edit/${tx.id}`)}
                          style={{ fontSize: "12px", fontWeight: 600, color: theme.textMuted, background: "none", border: "none", cursor: "pointer" }}
                        >
                          수정
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FAB (Floating Action Button) ────────
          내역 추가 페이지(/add)로 이동
          화면 우하단 고정, BottomNav 위에 위치
      ─────────────────────────────────────── */}
      <button
        onClick={() => navigate("/add")}
        style={{
          position: "fixed",
          bottom: "88px", right: "calc(50% - 184px)",
          width: "48px", height: "48px",
          borderRadius: theme.radiusMd,
          background: theme.accent,
          border: "none",
          color: "white",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(79, 70, 229, 0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div style={{ height: "140px" }} />

      {/* ── 커플 연결 모달 ───────────────────────
          두 가지 기능:
          1) 초대 코드 생성 → 파트너에게 공유
          2) 코드 입력 → 파트너의 커플에 참여
      ─────────────────────────────────────── */}
      {showCoupleModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
          {/* 백드롭 클릭 시 모달 닫기 */}
          <div onClick={() => setShowCoupleModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.4)" }} />
          <div style={{ background: theme.surface, width: "92%", maxWidth: "420px", borderRadius: theme.radiusMd, border: `1px solid ${theme.border}`, padding: "18px", zIndex: 41 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: theme.text }}>커플 연결</div>
              <button onClick={() => setShowCoupleModal(false)} style={{ all: "unset", cursor: "pointer", color: theme.textMuted }}>✕</button>
            </div>

            {/* 초대 코드 생성 / 초기화 버튼 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={async () => {
                  try {
                    setIsCreating(true);
                    if (!auth.currentUser) throw new Error("로그인 필요");
                    // Firestore에 couple 문서 생성 + 초대 코드 반환
                    const res = await coupleService.createCouple(auth.currentUser.uid);
                    setInviteCode(res.inviteCode);
                    // 코드 생성 직후 리스너 붙이기 (파트너 참여 즉시 감지)
                    attachCoupleListener(res.coupleId, auth.currentUser.uid);
                  } catch (e: any) {
                    alert(e.message || String(e));
                  } finally {
                    setIsCreating(false);
                  }
                }}
                style={{ flex: 1, padding: "10px", borderRadius: theme.radiusSm, background: theme.surfaceMuted, border: `1px solid ${theme.border}`, cursor: "pointer", fontWeight: 600, color: theme.text }}
              >
                {isCreating ? "생성중..." : "초대 코드 생성"}
              </button>
              <button
                onClick={() => setInviteCode("")}
                style={{ padding: "10px", borderRadius: theme.radiusSm, background: theme.surfaceMuted, border: `1px solid ${theme.border}`, cursor: "pointer", fontWeight: 600, color: theme.textMuted }}
              >
                초기화
              </button>
            </div>

            {/* 생성된 초대 코드 표시 + 클립보드 복사 */}
            {inviteCode ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>초대 코드</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, padding: "10px", borderRadius: theme.radiusSm, background: theme.surfaceMuted, fontWeight: 700, color: theme.text, border: `1px solid ${theme.border}` }}>{inviteCode}</div>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(inviteCode);
                      alert("코드가 복사되었습니다.");
                    }}
                    style={{ padding: "8px 10px", borderRadius: theme.radiusSm, background: theme.accent, color: "white", border: "none", cursor: "pointer" }}
                  >복사</button>
                </div>
              </div>
            ) : null}

            {/* 파트너 초대 코드 입력 → 커플에 참여 */}
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>코드로 참여</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())} // 자동 대문자 변환
                  placeholder="초대 코드 입력"
                  style={{ flex: 1, padding: "10px", borderRadius: theme.radiusSm, border: `1px solid ${theme.border}` }}
                />
                <button
                  onClick={async () => {
                    try {
                      if (!auth.currentUser) throw new Error("로그인 필요");
                      const code = inputCode.trim().toUpperCase();
                      if (!code) return alert("코드를 입력하세요.");
                      // 코드로 커플 문서 찾아서 members에 내 uid 추가
                      const result = await coupleService.joinByCode(auth.currentUser.uid, code);
                      // 참여 후 리스너 붙이기
                      attachCoupleListener(result.coupleId, auth.currentUser!.uid);
                      alert("참여되었습니다.");
                      setShowCoupleModal(false);
                    } catch (e: any) {
                      alert(e.message || String(e));
                    }
                  }}
                  style={{ padding: "10px", borderRadius: theme.radiusSm, background: theme.accent, color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
                >참여</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
};

export default HomePage;
