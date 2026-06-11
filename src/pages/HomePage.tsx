import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import coupleService from "../services/coupleService";
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import type { Transaction } from "../types/index";

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

  // ── Refs ───────────────────────────────────
  // 커플 문서 실시간 리스너의 해제 함수를 저장
  // useRef를 쓰는 이유: 리렌더링 없이 최신 값 유지 + cleanup 함수 외부 접근 가능
  const coupleUnsubRef = useRef<(() => void) | null>(null);

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
        // 파트너 uid로 Firestore users 컬렉션에서 이름 조회
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

        try {
          // 내 커플 문서 조회 (couples 컬렉션에서 members 배열에 내 uid가 있는 문서)
          const myCouple = await coupleService.getMyCouple(user.uid);

          let txData: Transaction[] = [];

          if (myCouple && myCouple.members.length >= 2) {
            // ── 커플 연결 완료 (members가 2명 이상) ──
            // 초대 코드만 생성한 상태(members 1명)는 여기 해당 안 됨
            setCoupleInfo(myCouple);
            setInviteCode(myCouple.inviteCode ?? "");
            attachCoupleListener(myCouple.id, user.uid);

            // 두 가지 쿼리를 동시에 실행 (Promise.all로 병렬 처리)
            // 1) coupleId로 저장된 내역 (커플 연결 이후 작성분)
            // 2) createdBy로 저장된 내역 (커플 연결 전 혼자 작성한 내역 포함)
            const [coupleSnap, soloSnap] = await Promise.all([
              getDocs(query(
                collection(db, "transactions"),
                where("coupleId", "==", myCouple.id),
                orderBy("date", "desc"), limit(20)
              )),
              getDocs(query(
                collection(db, "transactions"),
                where("createdBy", "==", user.uid),
                orderBy("date", "desc"), limit(20)
              )),
            ]);

            // 두 결과를 합치고 중복 제거 (같은 문서가 양쪽에 있을 수 있음)
            const allDocs = [...coupleSnap.docs, ...soloSnap.docs];
            const seen = new Set();
            txData = allDocs
              .filter(d => {
                if (seen.has(d.id)) return false;
                seen.add(d.id);
                return true;
              })
              .map(d => ({ id: d.id, ...d.data() })) as Transaction[];

            // 날짜 내림차순 정렬 (최신순)
            txData.sort((a, b) => b.date.localeCompare(a.date));

          } else {
            // ── 혼자 사용 중이거나 초대 코드만 생성한 상태 ──
            // members가 1명이면 커플 연결 전이므로 본인 내역만 조회
            const soloQ = query(
              collection(db, "transactions"),
              where("createdBy", "==", user.uid),
              orderBy("date", "desc"),
              limit(20)
            );
            const soloSnap = await getDocs(soloQ);
            txData = soloSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Transaction[];
          }

          // 조회한 내역으로 상태 업데이트
          setTransactions(txData);
          // 지출 합계: type === "expense"인 항목의 amount 합산
          setTotalExpense(txData.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0));
          // 수입 합계: type === "income"인 항목의 amount 합산
          setTotalIncome(txData.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0));

        } catch (e) {
          console.error(e);
        }

      } else {
        // ── 비로그인 상태 → 로그인 페이지로 이동 ──
        navigate("/");
      }

      // Firebase 응답이 완료됐으므로 로딩 종료
      setLoading(false);
    });

    // 컴포넌트 언마운트 시 cleanup
    // - 커플 실시간 리스너 해제
    // - onAuthStateChanged 리스너 해제
    return () => {
      if (coupleUnsubRef.current) coupleUnsubRef.current();
      unsubscribe();
    };
  }, [navigate]);

  // ─────────────────────────────────────────────
  // ⏳ Firebase 인증 응답 대기 중 로딩 화면
  // loading이 true인 동안 빈 화면 대신 표시 → "아직 내역이 없어요" flash 방지
  // ─────────────────────────────────────────────
  if (loading) return (
    <div style={{
      minHeight: "100svh",
      background: "#f5f3ff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ fontSize: 36, animation: "heartbeat 1.6s ease-in-out infinite" }}>💜</div>
    </div>
  );

  // 순액 = 수입 - 지출
  const net = totalIncome - totalExpense;
  // 날짜별로 그룹핑된 내역 (타임라인 렌더링용)
  const grouped = groupByDate(transactions);

  return (
    <div style={{
      minHeight: "100svh",
      background: "#f5f3ff",
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "180px",
      position: "relative",
    }}>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float0 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .tx-card:hover {
          transform: translateX(3px);
          box-shadow: 0 4px 20px rgba(155, 142, 196, 0.15) !important;
        }
        .fab-btn:hover {
          transform: scale(1.1) !important;
          box-shadow: 0 8px 28px rgba(155, 142, 196, 0.4) !important;
        }
        .fab-btn:active {
          transform: scale(0.95) !important;
        }
        .logout-btn:hover {
          background: rgba(90, 71, 50, 0.15) !important;
        }
      `}</style>

      {/* 배경 빛망울 — 장식용 블러 원 */}
      <div style={{
        position: "fixed", top: "-100px", right: "-80px",
        width: "300px", height: "300px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(190, 155, 110, 0.15), transparent)",
        filter: "blur(50px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: "150px", left: "-100px",
        width: "280px", height: "280px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(210, 170, 120, 0.12), transparent)",
        filter: "blur(50px)", pointerEvents: "none", zIndex: 0,
      }} />

      {/* ── 헤더 ───────────────────────────────
          - 앱 타이틀
          - 파트너 연결 상태에 따라 "커플 연결" 버튼 or "OO님과 연결됨 + 연결 해제" 버튼 표시
      ─────────────────────────────────────── */}
      <div style={{
        background: "#ffffff",
        padding: "28px 20px 36px",
        borderRadius: "0 0 32px 32px",
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        borderBottom: "2px dashed rgba(196, 196, 196, 0.28)",
        animation: "fadeUp 0.5s ease both",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#3C3489" }}>MoneyDuo</div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#b0a8e8", opacity: 0.85 }}>우리 둘의 재정 현황</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {partnerName ? (
              /* 파트너가 있는 경우: 이름 + 연결 해제 버튼 */
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#6B5CE7" }}>{partnerName}님과 연결됨</div>
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
                  style={{ all: "unset", padding: "8px 10px", background: "#fff0f6", borderRadius: 10, cursor: "pointer", fontWeight: 800 }}
                >
                  연결 해제
                </button>
              </>
            ) : (
              /* 파트너가 없는 경우: 커플 연결 모달 열기 버튼 */
              <button
                onClick={() => setShowCoupleModal(true)}
                style={{
                  all: "unset",
                  padding: "8px 12px",
                  background: "linear-gradient(135deg, #9B8EC4, #B8AEDE)",
                  border: "none",
                  color: "white",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                커플 연결
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 요약 카드 ───────────────────────────
          수입 / 지출 / 순액을 3등분 그리드로 표시
          헤더 아래로 살짝 올라오는 overlap 효과 (margin: -18px)
      ─────────────────────────────────────── */}
      <div style={{
        margin: "-18px 16px 0",
        background: "rgba(255,255,255,0.80)",
        backdropFilter: "blur(16px)",
        borderRadius: "20px",
        border: "2px solid rgba(184, 174, 222, 0.35)",
        boxShadow: "0 4px 24px #B8AEDE22",
        overflow: "hidden",
        position: "relative",
        zIndex: 2,
        animation: "fadeUp 0.5s 0.1s ease both",
        opacity: 0,
        animationFillMode: "forwards",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {[
            { label: "수입", value: `+${totalIncome.toLocaleString()}`, color: "#3B8C3B", bg: "#f0fdf4" },
            { label: "지출", value: `-${totalExpense.toLocaleString()}`, color: "#d4537e", bg: "#fff0f6" },
            { label: "순액", value: `${net >= 0 ? "+" : ""}${net.toLocaleString()}`, color: net >= 0 ? "#7A6FA8" : "#d4537e", bg: net >= 0 ? "#f2f0fa" : "#fff0f6" },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "14px 4px",
              borderRight: i < 2 ? "1.5px solid #e8e4f5" : "none",
              background: item.bg,
            }}>
              <span style={{ fontSize: "10px", color: "#6b65a8", fontWeight: 800, marginBottom: "4px" }}>
                {item.label}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 900, color: item.color, letterSpacing: "-0.3px" }}>
                {item.value}
              </span>
              <span style={{ fontSize: "10px", fontWeight: 800, color: "#6b65a8", marginTop: "1px" }}>원</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 타임라인 ────────────────────────────
          날짜별로 묶인 거래 내역을 세로로 나열
          내역이 없으면 빈 상태 안내 표시
      ─────────────────────────────────────── */}
      <div style={{ padding: "20px 16px 0", position: "relative", zIndex: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px",
          animation: "fadeUp 0.5s 0.2s ease both", opacity: 0, animationFillMode: "forwards",
        }}>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#7A6FA8" }}>최근 내역</span>
          <div style={{ flex: 1, height: "1.5px", background: "linear-gradient(to right, #e8e4f5, transparent)" }} />
          <span style={{ fontSize: "13px" }}>📋</span>
        </div>

        {grouped.length === 0 ? (
          /* 내역 없음 상태 */
          <div style={{
            textAlign: "center", padding: "48px 0",
            animation: "fadeUp 0.5s 0.3s ease both", opacity: 0, animationFillMode: "forwards",
          }}>
            <div style={{ fontSize: 40, marginBottom: 10, animation: "float0 2.5s ease-in-out infinite" }}>🐾</div>
            <div style={{ fontSize: "13px", color: "#9e99cc", fontWeight: 700 }}>아직 내역이 없어요</div>
            <div style={{ fontSize: "11px", color: "#cfc8f0", marginTop: 4 }}>첫 번째 내역을 추가해보세요 💕</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {grouped.map(([date, txs], gi) => {
              // 해당 날짜의 순액 계산
              const dayNet =
                txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) -
                txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
              return (
                <div key={date} style={{
                  animation: `fadeUp 0.5s ${0.2 + gi * 0.07}s ease both`,
                  opacity: 0, animationFillMode: "forwards",
                }}>
                  {/* 날짜 헤더 행 */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    marginBottom: "10px",
                  }}>
                    <div style={{
                      background: "linear-gradient(135deg, #9B8EC4, #B8AEDE)",
                      borderRadius: "10px",
                      padding: "3px 10px",
                      fontSize: "10px", fontWeight: 800, color: "white",
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 8px #9B8EC430",
                    }}>
                      {formatDate(date)}
                    </div>
                    <div style={{ flex: 1, height: "1px", background: "#ede9fe" }} />
                    {/* 해당 날짜 순액 (양수면 초록, 음수면 핑크) */}
                    <span style={{
                      fontSize: "10px", fontWeight: 800,
                      color: dayNet >= 0 ? "#3B8C3B" : "#d4537e",
                    }}>
                      {dayNet >= 0 ? "+" : ""}{dayNet.toLocaleString()}원
                    </span>
                  </div>

                  {/* 해당 날짜의 거래 목록 (타임라인 세로선 포함) */}
                  <div style={{
                    display: "flex", flexDirection: "column", gap: "8px",
                    paddingLeft: "10px",
                    borderLeft: "2.5px solid #e4dff5", // 타임라인 세로선
                    marginLeft: "4px",
                  }}>
                    {txs.map((tx) => (
                      <div
                        key={tx.id}
                        className="tx-card"
                        style={{
                          background: "rgba(255,255,255,0.75)",
                          backdropFilter: "blur(8px)",
                          borderRadius: "16px",
                          border: "1.5px solid rgba(184,174,222,0.35)",
                          padding: "11px 14px",
                          display: "flex", alignItems: "center", gap: "12px",
                          cursor: "default",
                        }}
                      >
                        {/* 카테고리 이모지 아이콘 영역 */}
                        <div style={{
                          width: "38px", height: "38px", borderRadius: "14px",
                          background: tx.type === "expense"
                            ? "linear-gradient(135deg, #ffe4f0, #ffd6ee)" // 지출: 핑크
                            : "linear-gradient(135deg, #e4f5e4, #d6f0d6)", // 수입: 연초록
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "18px", flexShrink: 0,
                        }}>
                          {tx.category.split(" ")[0]} {/* 카테고리 첫 번째 토큰 (이모지) */}
                        </div>

                        {/* 내역 설명 + 결제자 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: "13px", fontWeight: 800,
                            color: "#3C3489", whiteSpace: "nowrap",
                            overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {tx.description}
                          </div>
                          {/* paidBy: "me" | "partner" | "together" */}
                          <div style={{ fontSize: "11px", fontWeight: 800, color: "#6b65a8", marginTop: "2px" }}>
                            {tx.paidBy === "me" ? "🐰 나" : tx.paidBy === "partner" ? "🐻 짝꿍" : "💕 같이"}
                          </div>
                        </div>

                        {/* 금액 (지출: 빨강/핑크, 수입: 초록) */}
                        <div style={{
                          fontSize: "13px", fontWeight: 900,
                          color: tx.type === "expense" ? "#d4537e" : "#3B8C3B",
                          whiteSpace: "nowrap",
                        }}>
                          {tx.type === "expense" ? "-" : "+"}{tx.amount.toLocaleString()}원
                        </div>

                        {/* 수정 버튼 → /edit/:id 페이지로 이동 */}
                        <button
                          onClick={() => navigate(`/edit/${tx.id}`)}
                          style={{ fontSize: "13px", fontWeight: 800, color: "#6b65a8", background: "none", border: "none", cursor: "pointer" }}
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
        className="fab-btn"
        onClick={() => navigate("/add")}
        style={{
          position: "fixed",
          bottom: "88px", right: "calc(50% - 184px)",
          width: "52px", height: "52px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #9B8EC4, #B8AEDE)",
          border: "none",
          color: "white",
          cursor: "pointer",
          boxShadow: "0 4px 20px #9B8EC460",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
          zIndex: 10,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round">
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
          <div onClick={() => setShowCoupleModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
          <div style={{ background: "white", width: "92%", maxWidth: "420px", borderRadius: "12px", padding: "18px", zIndex: 41 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>커플 연결</div>
              <button onClick={() => setShowCoupleModal(false)} style={{ all: "unset", cursor: "pointer" }}>✕</button>
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
                style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#f5f0ff", border: "none", cursor: "pointer", fontWeight: 800 }}
              >
                {isCreating ? "생성중..." : "초대 코드 생성"}
              </button>
              <button
                onClick={() => setInviteCode("")}
                style={{ padding: "10px", borderRadius: 10, background: "#fff0f6", border: "none", cursor: "pointer", fontWeight: 800 }}
              >
                초기화
              </button>
            </div>

            {/* 생성된 초대 코드 표시 + 클립보드 복사 */}
            {inviteCode ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#7a5a3f", marginBottom: 6 }}>초대 코드</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, padding: "10px", borderRadius: 8, background: "#f7f7fb", fontWeight: 900 }}>{inviteCode}</div>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(inviteCode);
                      alert("코드가 복사되었습니다.");
                    }}
                    style={{ padding: "8px 10px", borderRadius: 8, background: "#9B8EC4", color: "white", border: "none", cursor: "pointer" }}
                  >복사</button>
                </div>
              </div>
            ) : null}

            {/* 파트너 초대 코드 입력 → 커플에 참여 */}
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, color: "#7a5a3f", marginBottom: 6 }}>코드로 참여</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())} // 자동 대문자 변환
                  placeholder="초대 코드 입력"
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #eee" }}
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
                  style={{ padding: "10px", borderRadius: 8, background: "#6B5CE7", color: "white", border: "none", cursor: "pointer", fontWeight: 800 }}
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