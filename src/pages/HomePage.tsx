import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import coupleService from "../services/coupleService";
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import type { Transaction } from "../types/index";

const groupByDate = (transactions: Transaction[]) => {
  const map = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const list = map.get(tx.date) ?? [];
    list.push(tx);
    map.set(tx.date, list);
  }
  return Array.from(map.entries());
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

const HomePage = () => {
  const navigate = useNavigate();
  const [, setUserName] = useState("");
  const [showCoupleModal, setShowCoupleModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [, setCoupleInfo] = useState<any>(null);
  const [partnerName, setPartnerName] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);

  useEffect(() => {
    let coupleUnsub: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserName(user.displayName || "");
        const q = query(
          collection(db, "transactions"),
          where("createdBy", "==", user.uid),
          orderBy("date", "desc"),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        setTransactions(data);
        setTotalExpense(
          data.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
        );
        setTotalIncome(
          data.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
        );

        // 실시간 커플 리스너 설정
        try {
          if (coupleUnsub) {
            coupleUnsub();
            coupleUnsub = null;
          }
          const myCouple = await coupleService.getMyCouple(user.uid);
          if (myCouple) {
            setCoupleInfo(myCouple);
            setInviteCode(myCouple.inviteCode ?? "");
            coupleUnsub = coupleService.listenToCouple(myCouple.id, async (data) => {
              setCoupleInfo(data);
              if (!data) {
                setPartnerName("");
                setInviteCode("");
                return;
              }
              const members: string[] = data.members ?? [];
              const partnerUid = members.find((m) => m !== user.uid);
              if (partnerUid) {
                const userSnap = await getDoc(doc(db, "users", partnerUid));
                const p = userSnap.exists() ? (userSnap.data() as any) : null;
                setPartnerName(p?.displayName || "");
              } else {
                setPartnerName("");
              }
            });
          } else {
            setCoupleInfo(null);
            setPartnerName("");
            setInviteCode("");
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        navigate("/");
      }
    });
    return () => {
      if (coupleUnsub) coupleUnsub();
      unsubscribe();
    };
  }, [navigate]);

  // const handleLogout = async () => {
  //   await auth.signOut();
  //   navigate("/");
  // };

  // const now = new Date();
  // const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  const net = totalIncome - totalExpense;
  const grouped = groupByDate(transactions);

  return (
    <div style={{
      minHeight: "100svh",
      background: "linear-gradient(180deg, #fbf3e7 0%, #f7efe3 10%, #fdf9f4 100%)",
      backgroundImage: "repeating-linear-gradient(180deg, transparent, transparent 28px, rgba(190, 155, 110, 0.05) 29px, transparent 30px)",
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
          box-shadow: 0 4px 20px rgba(190, 155, 110, 0.15) !important;
        }
        .fab-btn:hover {
          transform: scale(1.1) !important;
          box-shadow: 0 8px 28px rgba(184, 149, 106, 0.4) !important;
        }
        .fab-btn:active {
          transform: scale(0.95) !important;
        }
        .logout-btn:hover {
          background: rgba(90, 71, 50, 0.15) !important;
        }
      `}</style>

      {/* 배경 빛망울 */}
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

      {/* 헤더 */}
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
          {/* <button onClick={() => navigate(-1)} style={{
            all: "unset",
            width: "36px",
            height: "36px",
            borderRadius: "12px",
            background: "#fff7e8",
            border: "1px solid rgba(148, 120, 90, 0.24)",
            color: "#7a5a3f",
            fontSize: "16px",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 10px rgba(120, 85, 48, 0.12)",
          }}>←</button> */}
          <div style={{ color: "#5d4732" }}>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>MoneyDuo</div>
            <div style={{ fontSize: "12px", opacity: 0.85 }}>우리 둘의 재정 현황</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {partnerName ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#6B5CE7" }}>{partnerName}님과 연결됨</div>
                <button
                  onClick={async () => {
                    if (!auth.currentUser) return;
                    const ok = confirm("커플 연결을 해제하시겠어요?");
                    if (!ok) return;
                    try {
                      await coupleService.leaveCouple(auth.currentUser.uid);
                      setPartnerName("");
                      setCoupleInfo(null);
                      setInviteCode("");
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
              <button
                onClick={() => setShowCoupleModal(true)}
                style={{
                  all: "unset",
                  padding: "8px 12px",
                  background: "#fff7e8",
                  border: "1px solid rgba(148, 120, 90, 0.12)",
                  borderRadius: "12px",
                  color: "#7a5a3f",
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

      {/* 요약 카드 — 헤더에 살짝 겹치게 */}
      <div style={{
        margin: "-18px 16px 0",
        background: "rgba(255,255,255,0.80)",
        backdropFilter: "blur(16px)",
        borderRadius: "20px",
        border: "2px solid rgba(201,194,245,0.45)",
        boxShadow: "0 4px 24px #c9b4f522",
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
            { label: "순액", value: `${net >= 0 ? "+" : ""}${net.toLocaleString()}`, color: net >= 0 ? "#6B5CE7" : "#d4537e", bg: net >= 0 ? "#f5f0ff" : "#fff0f6" },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "14px 4px",
              borderRight: i < 2 ? "1.5px solid #ede9fe" : "none",
              background: item.bg,
            }}>
              <span style={{ fontSize: "10px", color: "#9e99cc", fontWeight: 800, marginBottom: "4px" }}>
                {item.label}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 900, color: item.color, letterSpacing: "-0.3px" }}>
                {item.value}
              </span>
              <span style={{ fontSize: "9px", color: "#c4bfea", marginTop: "1px" }}>원</span>
            </div>
          ))}
        </div>
      </div>

      {/* 타임라인 */}
      <div style={{ padding: "20px 16px 0", position: "relative", zIndex: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px",
          animation: "fadeUp 0.5s 0.2s ease both", opacity: 0, animationFillMode: "forwards",
        }}>
          <span style={{
            fontSize: "16px", fontWeight: 700, color: "#6B5CE7",
          }}>최근 내역</span>
          <div style={{ flex: 1, height: "1.5px", background: "linear-gradient(to right, #ddd6fe, transparent)" }} />
          <span style={{ fontSize: "13px" }}>📋</span>
        </div>

        {grouped.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "48px 0",
            animation: "fadeUp 0.5s 0.3s ease both", opacity: 0, animationFillMode: "forwards",
          }}>
            <div style={{ fontSize: 40, marginBottom: 10, animation: "float0 2.5s ease-in-out infinite" }}>🐾</div>
            <div style={{ fontSize: "13px", color: "#b0a8e8", fontWeight: 700 }}>아직 내역이 없어요</div>
            <div style={{ fontSize: "11px", color: "#cfc8f0", marginTop: 4 }}>첫 번째 내역을 추가해보세요 💕</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {grouped.map(([date, txs], gi) => {
              const dayNet =
                txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) -
                txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
              return (
                <div key={date} style={{
                  animation: `fadeUp 0.5s ${0.2 + gi * 0.07}s ease both`,
                  opacity: 0, animationFillMode: "forwards",
                }}>
                  {/* 날짜 헤더 */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    marginBottom: "10px",
                  }}>
                    <div style={{
                      background: "linear-gradient(135deg, #7f77dd, #a78bfa)",
                      borderRadius: "10px",
                      padding: "3px 10px",
                      fontSize: "10px", fontWeight: 800, color: "white",
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 8px #7f77dd30",
                    }}>
                      {formatDate(date)}
                    </div>
                    <div style={{ flex: 1, height: "1px", background: "#ede9fe" }} />
                    <span style={{
                      fontSize: "10px", fontWeight: 800,
                      color: dayNet >= 0 ? "#3B8C3B" : "#d4537e",
                    }}>
                      {dayNet >= 0 ? "+" : ""}{dayNet.toLocaleString()}원
                    </span>
                  </div>

                  {/* 내역 카드들 */}
                  <div style={{
                    display: "flex", flexDirection: "column", gap: "8px",
                    paddingLeft: "10px",
                    borderLeft: "2.5px solid #ddd6fe",
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
                          border: "1.5px solid rgba(201,194,245,0.4)",
                          padding: "11px 14px",
                          display: "flex", alignItems: "center", gap: "12px",
                          cursor: "default",
                        }}
                      >
                        <div style={{
                          width: "38px", height: "38px", borderRadius: "14px",
                          background: tx.type === "expense"
                            ? "linear-gradient(135deg, #ffe4f0, #ffd6ee)"
                            : "linear-gradient(135deg, #e4f5e4, #d6f0d6)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "18px", flexShrink: 0,
                        }}>
                          {tx.category.split(" ")[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: "13px", fontWeight: 800,
                            color: "#3C3489", whiteSpace: "nowrap",
                            overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {tx.description}
                          </div>
                          <div style={{ fontSize: "10px", color: "#b0a8e8", marginTop: "2px" }}>
                            {tx.paidBy === "me" ? "🐰 나" : tx.paidBy === "partner" ? "🐻 짝꿍" : "💕 같이"}
                          </div>
                        </div>
                        <div style={{
                          fontSize: "13px", fontWeight: 900,
                          color: tx.type === "expense" ? "#d4537e" : "#3B8C3B",
                          whiteSpace: "nowrap",
                          }}>
                          {tx.type === "expense" ? "-" : "+"}{tx.amount.toLocaleString()}원
                        </div>
                        <button
                          onClick={() => navigate(`/edit/${tx.id}`)}
                          style={{ fontSize: "11px", color: "#b0a8e8", background: "none", border: "none", cursor: "pointer" }}
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

      {/* FAB 추가 버튼 */}
      <button
        className="fab-btn"
        onClick={() => navigate("/add")}
        style={{
          position: "fixed",
          bottom: "88px", right: "calc(50% - 184px)",
          width: "52px", height: "52px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #7f77dd, #a78bfa)",
          border: "none",
          color: "white",
          cursor: "pointer",
          boxShadow: "0 4px 20px #7f77dd60",
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
      {showCoupleModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
          <div onClick={() => setShowCoupleModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
          <div style={{ background: "white", width: "92%", maxWidth: "420px", borderRadius: "12px", padding: "18px", zIndex: 41 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>커플 연결</div>
              <button onClick={() => setShowCoupleModal(false)} style={{ all: "unset", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={async () => {
                  try {
                    setIsCreating(true);
                    if (!auth.currentUser) throw new Error("로그인 필요");
                    const res = await coupleService.createCouple(auth.currentUser.uid);
                    setInviteCode(res.inviteCode);
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
                onClick={() => {
                  setInviteCode("");
                }}
                style={{ padding: "10px", borderRadius: 10, background: "#fff0f6", border: "none", cursor: "pointer", fontWeight: 800 }}
              >
                초기화
              </button>
            </div>

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
                    style={{ padding: "8px 10px", borderRadius: 8, background: "#7f77dd", color: "white", border: "none", cursor: "pointer" }}
                  >복사</button>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, color: "#7a5a3f", marginBottom: 6 }}>코드로 참여</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} placeholder="초대 코드 입력" style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #eee" }} />
                <button
                  onClick={async () => {
                    try {
                      if (!auth.currentUser) throw new Error("로그인 필요");
                      const code = inputCode.trim().toUpperCase();
                      if (!code) return alert("코드를 입력하세요.");
                      await coupleService.joinByCode(auth.currentUser.uid, code);
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