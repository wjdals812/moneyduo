import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import coupleService, { perfLog } from "../services/coupleService";
import { getDoc, doc } from "firebase/firestore";
import { fetchMonthTransactions, getCachedMonth } from "../services/transactionService";
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
  const [coupleTab, setCoupleTab] = useState<"create" | "join">("create"); // 모달 탭
  const [inviteCode, setInviteCode] = useState("");          // 내가 생성한 초대 코드
  const [inputCode, setInputCode] = useState("");              // 파트너 초대 코드 입력값
  const [isJoining, setIsJoining] = useState(false);            // 참여 처리 중 (연타 방지)
  const [isCreating, setIsCreating] = useState(false);         // 초대 코드 생성 중 로딩 상태
  const [coupleInfo, setCoupleInfo] = useState<any>(null);               // 커플 문서 데이터 (파트너 감지용)
  const [partnerName, setPartnerName] = useState("");          // 파트너 이름 (헤더에 표시)
  const [transactions, setTransactions] = useState<Transaction[]>([]); // 거래 내역 목록
  const [totalExpense, setTotalExpense] = useState(0);         // 총 지출 합계
  const [totalIncome, setTotalIncome] = useState(0);           // 총 수입 합계
  const [loading, setLoading] = useState(true);                // Firebase 인증 응답 대기 중 여부
                                                               // (true일 때 로딩 화면 표시 → flash 방지)
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null); // 이미 로그인된 상태면 인증 콜백을 기다리지 않고 바로 조회
  const [month, setMonth] = useState<Date>(new Date());
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null); // 내가 설정한 월 예산 (없으면 null)

  // ── Refs ───────────────────────────────────
  // 커플 문서 실시간 리스너의 해제 함수를 저장
  // useRef를 쓰는 이유: 리렌더링 없이 최신 값 유지 + cleanup 함수 외부 접근 가능
  const coupleUnsubRef = useRef<(() => void) | null>(null);
  // 이 리스너로 파트너를 한 번이라도 확인했는지 (이후 파트너가 사라지면 "상대가 해제함" 알림)
  const hadPartnerRef = useRef(false);
  // 진행 중인 연결 해제 처리. 화면은 즉시 바뀌지만 서버 처리가 끝나기 전에 참여/생성이 겹치지 않도록 기다린다
  const leavingRef = useRef<Promise<void>>(Promise.resolve());
  // 가장 최근에 요청된 monthKey를 추적 (오래된 fetch가 늦게 도착해서 최신 월을 덮어쓰는 것 방지)
  const latestMonthKeyRef = useRef("");

  // 💾 거래 내역 반영 (캐시/서버 결과 공통)
  const applyTransactions = (txData: Transaction[]) => {
    setTransactions(txData);
    setTotalExpense(txData.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0));
    setTotalIncome(txData.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0));
  };

  const loadTransactions = async (userId: string, monthKey: string) => {
    latestMonthKeyRef.current = monthKey;
    try {
      // 커플 문서 조회는 생략: coupleId(캐시)만 있으면 되고, 커플 정보는 리스너가 비동기로 채움
      const coupleId = await coupleService.getMyCoupleId(userId);
      if (coupleId && !coupleUnsubRef.current) attachCoupleListener(coupleId, userId);

      const txData = await fetchMonthTransactions(userId, monthKey);
      // 이 fetch를 시작한 뒤 더 최신 월 요청이 들어왔다면 결과를 버림 (stale 데이터 방지)
      if (latestMonthKeyRef.current !== monthKey) return;
      applyTransactions(txData);
    } catch (e) {
      console.error(e);
    }
  };

  // ─────────────────────────────────────────────
  // 🔗 커플 문서에 실시간 리스너를 붙이는 헬퍼 함수
  // - 파트너가 참여하면 즉시 감지해서 partnerName 업데이트
  // - 중복 리스너 방지를 위해 기존 리스너를 먼저 해제하고 새로 붙임
  // ─────────────────────────────────────────────
  // 연결돼 있던 파트너가 사라졌을 때 한 번만 알림 (내가 해제/참여할 때는 리스너를 먼저 떼므로 뜨지 않음)
  const notifyPartnerLeft = () => {
    if (!hadPartnerRef.current) return;
    hadPartnerRef.current = false;
    alert("상대방이 연결을 해제했어요.");
  };

  const detachCoupleListener = () => {
    coupleUnsubRef.current?.();
    coupleUnsubRef.current = null;
  };

  const attachCoupleListener = (coupleId: string, currentUid: string) => {
    // 기존에 붙어있던 리스너가 있으면 먼저 해제
    if (coupleUnsubRef.current) {
      coupleUnsubRef.current();
      coupleUnsubRef.current = null;
    }
    hadPartnerRef.current = false;

    // 새 리스너 등록: 커플 문서가 변경될 때마다 콜백 실행
    coupleUnsubRef.current = coupleService.listenToCouple(coupleId, async (data) => {
      setCoupleInfo(data);

      // 커플 문서가 삭제됐거나 null이면 파트너 정보 초기화
      if (!data) {
        notifyPartnerLeft();
        setPartnerName("");
        setInviteCode("");
        return;
      }

      setInviteCode(data.inviteCode ?? "");

      // members 배열에서 나 자신을 제외한 uid = 파트너 uid
      const members: string[] = data.members ?? [];
      const partnerUid = members.find((m) => m !== currentUid);

      if (partnerUid) {
        hadPartnerRef.current = true;
        // 파트너 uid로 Firestore users 컬렉션에서 이름/이모지 조회
        try {
          const userSnap = await getDoc(doc(db, "users", partnerUid));
          const p = userSnap.exists() ? (userSnap.data() as any) : null;
          // 이름이 비어 있어도 파트너는 있으므로 "연결됨"이 보이도록 기본값 사용
          setPartnerName(p?.displayName || "상대방");
        } catch (e) {
          // 참여/해제 도중에는 users.coupleId가 아직 안 바뀌어 일시적으로 거부될 수 있음 (참여 후 리스너 재연결 시 정상 조회)
          console.warn("파트너 정보 조회 실패:", e);
          setPartnerName((prev) => prev || "상대방"); // 이름만 못 가져왔을 뿐 연결은 된 상태
        }
      } else {
        // 파트너가 아직 없거나, 있던 파트너가 연결을 해제한 상태
        notifyPartnerLeft();
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // ── 로그인된 상태 ──
        setUserName(user.displayName || "");
        setUid(user.uid);
        // 예산은 화면 로딩을 막지 않고 도착하는 대로 반영
        getDoc(doc(db, "userSettings", user.uid))
          .then((s) => setMonthlyBudget(s.exists() ? (s.data().monthlyBudget ?? null) : null))
          .catch(console.error);
      } else {
        // ── 비로그인 상태 → 로그인 페이지로 이동 ──
        navigate("/");
        setLoading(false);
      }
    });

    // 컴포넌트 언마운트 시 cleanup
    // - 커플 실시간 리스너 해제
    // - onAuthStateChanged 리스너 해제
    return () => {
      if (coupleUnsubRef.current) coupleUnsubRef.current();
      unsubscribe();
    };
  }, [navigate]);

  // 월 변경 시에는 내역만 다시 조회 (인증/예산/커플 리스너는 재실행하지 않음)
  useEffect(() => {
    if (!uid) return;
    // 캐시가 있으면 즉시 표시하고 뒤에서 갱신
    const cached = getCachedMonth(uid, formatMonthKey(month));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) { applyTransactions(cached); setLoading(false); }
    loadTransactions(uid, formatMonthKey(month)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, month]);

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
      paddingBottom: "90px",
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
            <div style={{ fontSize: "12px", fontWeight: 500, color: theme.textMuted }}>재정 현황</div>
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
                    const myUid = auth.currentUser.uid;
                    const known = coupleInfo?.id && Array.isArray(coupleInfo.members)
                      ? { coupleId: coupleInfo.id as string, members: coupleInfo.members as string[] }
                      : undefined; // 리스너가 가진 최신 커플 정보로 서버 조회 생략
                    // 서버 처리를 기다리지 않고 화면부터 즉시 해제 상태로 바꾼다
                    setPartnerName("");
                    applyTransactions(transactions.filter((t) => t.createdBy === myUid)); // 파트너 내역도 즉시 제거
                    setCoupleInfo(null);
                    setInviteCode("");
                    if (coupleUnsubRef.current) {
                      coupleUnsubRef.current();
                      coupleUnsubRef.current = null;
                    }
                    const t0 = performance.now(); // [perf] 임시 측정
                    leavingRef.current = (async () => {
                      try {
                        await coupleService.leaveCouple(myUid, known);
                        loadTransactions(myUid, formatMonthKey(month)); // 알럿(화면 멈춤) 전에 내역 재조회 시작
                        alert(`연결 해제되었습니다. (${Math.round(performance.now() - t0)}ms)`);
                      } catch (e: any) {
                        loadTransactions(myUid, formatMonthKey(month));
                        alert(e.message || String(e));
                      }
                    })();
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

        {/* ── 예산 사용률 ─────────────────────────
            내가 설정한 월 예산 대비 이 달 총지출(나+파트너 합산) 진행률
            예산 미설정 시 표시 안 함
        ─────────────────────────────────────── */}
        {monthlyBudget != null && monthlyBudget > 0 && (() => {
          const pct = Math.round((totalExpense / monthlyBudget) * 100);
          const barColor = pct >= 100 ? theme.danger : pct >= 80 ? "#d97706" : theme.accent;
          return (
            <div style={{
              marginBottom: "16px",
              background: theme.surface,
              borderRadius: theme.radiusMd,
              border: `1px solid ${theme.border}`,
              padding: "12px 14px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: theme.textMuted }}>이번 달 예산 사용률</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: barColor }}>{pct}%</span>
              </div>
              <div style={{ height: "6px", borderRadius: "3px", background: theme.surfaceMuted, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: barColor }} />
              </div>
            </div>
          );
        })()}

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
                        {/* 규칙상 수정은 작성자만 가능하므로 짝꿍이 쓴 내역엔 버튼을 숨긴다 */}
                        {tx.createdBy === auth.currentUser?.uid && (
                          <button
                            onClick={() => navigate(`/edit/${tx.id}`)}
                            style={{ fontSize: "12px", fontWeight: 600, color: theme.textMuted, background: "none", border: "none", cursor: "pointer" }}
                          >
                            수정
                          </button>
                        )}
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
          bottom: "calc(env(safe-area-inset-bottom) + 76px)", right: "calc(50% - 184px)",
          width: "40px", height: "40px",
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
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
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
          <div onClick={() => setShowCoupleModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.5)" }} />
          <div style={{ background: theme.surface, width: "86%", maxWidth: "320px", borderRadius: 14, padding: "20px 16px 16px", zIndex: 41, boxShadow: "0 20px 40px rgba(15, 23, 42, 0.2)" }}>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>커플 연결하기</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>초대 코드로 가계부를 함께 써요</div>
            </div>

            {/* 탭: 코드 만들기 / 코드 입력 */}
            <div style={{ display: "flex", background: theme.surfaceMuted, borderRadius: 10, padding: 3, marginBottom: 18 }}>
              {([["create", "코드 만들기"], ["join", "코드 입력"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCoupleTab(key)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: coupleTab === key ? theme.surface : "transparent", color: coupleTab === key ? theme.text : theme.textMuted, boxShadow: coupleTab === key ? theme.shadow : "none" }}
                >{label}</button>
              ))}
            </div>

            {coupleTab === "create" ? (
              <div style={{ textAlign: "center" }}>
                {inviteCode ? (
                  <>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>이 코드를 짝꿍에게 알려주세요</div>
                    <div style={{ padding: "12px", borderRadius: 10, background: theme.accentMuted, color: theme.accent, fontSize: 22, fontWeight: 800, letterSpacing: 4, marginBottom: 12 }}>{inviteCode}</div>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(inviteCode);
                        alert("코드가 복사되었습니다.");
                      }}
                      style={{ width: "100%", padding: "10px", borderRadius: 8, background: theme.accent, color: "white", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
                    >코드 복사</button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        setIsCreating(true);
                        if (!auth.currentUser) throw new Error("로그인 필요");
                        // Firestore에 couple 문서 생성 + 초대 코드 반환
                        await leavingRef.current;
                        detachCoupleListener();
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
                    style={{ width: "100%", padding: "10px", borderRadius: 8, background: theme.accent, color: "white", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
                  >{isCreating ? "생성중..." : "초대 코드 만들기"}</button>
                )}
              </div>
            ) : (
              <div>
                <input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())} // 자동 대문자 변환
                  placeholder="초대 코드 입력"
                  enterKeyHint="go"
                  onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget.nextElementSibling as HTMLButtonElement | null)?.click(); }} // 키보드 이동 키 = 연결하기
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surfaceMuted, textAlign: "center", fontSize: 15, fontWeight: 700, letterSpacing: 3, marginBottom: 12, outline: "none" }}
                />
                <button
                  onClick={async () => {
                    if (isJoining) return; // 연타하면 이미 멤버인 상태로 다시 추가하려 해 규칙에 거부됨
                    try {
                      if (!auth.currentUser) throw new Error("로그인 필요");
                      const code = inputCode.trim().toUpperCase();
                      if (!code) return alert("코드를 입력하세요.");
                      setIsJoining(true);
                      const t0 = performance.now(); // [perf] 임시 측정
                      perfLog.length = 0;
                      // 코드로 커플 문서 찾아서 members에 내 uid 추가
                      await leavingRef.current; // 진행 중인 해제가 끝난 뒤에 참여
                      perfLog.push(`해제 대기 ${Math.round(performance.now() - t0)}ms`);
                      detachCoupleListener(); // 기존 커플 정리 과정의 변화에 알림이 뜨지 않도록
                      const result = await coupleService.joinByCode(auth.currentUser.uid, code);
                      // 참여 후 리스너 붙이기
                      attachCoupleListener(result.coupleId, auth.currentUser!.uid);
                      loadTransactions(auth.currentUser!.uid, formatMonthKey(month)); // 파트너 내역 바로 반영
                      alert(`참여되었습니다. (${Math.round(performance.now() - t0)}ms)\n${perfLog.join("\n")}`);
                      setShowCoupleModal(false);
                    } catch (e: any) {
                      alert(e.message || String(e));
                    } finally {
                      setIsJoining(false);
                    }
                  }}
                  disabled={isJoining}
                  style={{ width: "100%", padding: "10px", borderRadius: 8, background: theme.accent, color: "white", border: "none", cursor: isJoining ? "default" : "pointer", opacity: isJoining ? 0.6 : 1, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
                >{isJoining ? "연결 중..." : "연결하기"}</button>
              </div>
            )}
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
};

export default HomePage;
