import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
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
  const [userName, setUserName] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);

  useEffect(() => {
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
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  const now = new Date();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  const net = totalIncome - totalExpense;
  const grouped = groupByDate(transactions);

  return (
    <div style={{
      minHeight: "100svh",
      background: "linear-gradient(160deg, #f5f0ff 0%, #fff0f7 50%, #f0f4ff 100%)",
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "100px",
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
          box-shadow: 0 4px 20px #c9b4f530 !important;
        }
        .fab-btn:hover {
          transform: scale(1.1) !important;
          box-shadow: 0 8px 28px #7f77dd80 !important;
        }
        .fab-btn:active {
          transform: scale(0.95) !important;
        }
        .logout-btn:hover {
          background: rgba(255,255,255,0.2) !important;
        }
      `}</style>

      {/* 배경 빛망울 */}
      <div style={{
        position: "fixed", top: "-80px", right: "-60px",
        width: "260px", height: "260px", borderRadius: "50%",
        background: "radial-gradient(circle, #e0d5ff55, transparent)",
        filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: "120px", left: "-80px",
        width: "240px", height: "240px", borderRadius: "50%",
        background: "radial-gradient(circle, #ffd6ee44, transparent)",
        filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
      }} />

      {/* 헤더 */}
      <div style={{
        background: "linear-gradient(135deg, #7f77dd 0%, #a78bfa 100%)",
        padding: "28px 20px 36px",
        borderRadius: "0 0 32px 32px",
        marginBottom: "0",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 8px 32px #7f77dd40",
        animation: "fadeUp 0.5s ease both",
      }}>
        {/* 헤더 장식 원 */}
        <div style={{
          position: "absolute", top: "-30px", right: "-30px",
          width: "120px", height: "120px", borderRadius: "50%",
          background: "rgba(255,255,255,0.1)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-20px", right: "60px",
          width: "80px", height: "80px", borderRadius: "50%",
          background: "rgba(255,255,255,0.07)", pointerEvents: "none",
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div  style={{ fontSize: "11px", color: "#ddd6fe", fontWeight: 700, marginBottom: "2px" }}>
              {monthLabel} 🗓️
            </div>
            <div style={{
              fontSize: "26px", fontWeight: 700,
              color: "white", lineHeight: 1.2,
            }}>
              MoneyDuo 💜
            </div>
            <div style={{ fontSize: "12px", color: "#ddd6fe", marginTop: "4px" }}>
              안녕하세요, <span style={{ fontWeight: 800, color: "white" }}>{userName}</span>님! 🐰
            </div>
          </div>
          <button
            className="logout-btn"
            onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1.5px solid rgba(255,255,255,0.3)",
              borderRadius: "12px",
              color: "white",
              fontSize: "11px",
              fontWeight: 700,
              padding: "6px 12px",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            로그아웃
          </button>
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
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          transition: "transform 0.15s ease, box-shadow 0.15s ease",
                          cursor: "default",
                        }}
                      >
                        <div style={{
                          width: "38px", height: "38px",
                          borderRadius: "14px",
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

      <BottomNav />
    </div>
  );
};

export default HomePage;