import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import type { Transaction } from "../types/index";

type FilterType = "all" | "me" | "together" | "partner";

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

const TransactionPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [, setUid] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        const q = query(
          collection(db, "transactions"),
          where("createdBy", "==", user.uid),
          orderBy("date", "desc")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        setTransactions(data);
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const filtered = filter === "all" ? transactions : transactions.filter((t) => t.paidBy === filter);

  const grouped = filtered.reduce((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = [];
    acc[tx.date].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const filters: { key: FilterType; label: string; emoji: string }[] = [
    { key: "all", label: "전체", emoji: "💜" },
    { key: "me", label: "나", emoji: "🐰" },
    { key: "partner", label: "짝꿍", emoji: "🐻" },
    { key: "together", label: "같이", emoji: "💕" }
  ];

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
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float0 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }
        .tx-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .tx-card:hover { transform: translateX(3px); box-shadow: 0 4px 20px #c9b4f530 !important; }
        .filter-btn { transition: all 0.18s ease; }
        .filter-btn:active { transform: scale(0.95); }
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
        boxShadow: "0 8px 32px #7f77dd40",
        position: "relative",
        overflow: "hidden",
        animation: "fadeUp 0.5s ease both",
      }}>
        <div style={{
          position: "absolute", top: "-30px", right: "-30px",
          width: "120px", height: "120px", borderRadius: "50%",
          background: "rgba(255,255,255,0.1)", pointerEvents: "none",
        }} />
        <div style={{
          fontSize: "26px", fontWeight: 700, color: "white",
        }}>
          내역 📋
        </div>
        <div style={{ fontSize: "11px", color: "#ddd6fe", marginTop: "2px" }}>
          우리 둘의 소비 기록 💕
        </div>
      </div>

      <div style={{ padding: "0 16px", position: "relative", zIndex: 1 }}>

        {/* 필터 탭 — 헤더에 살짝 겹치게 */}
        <div style={{
          margin: "-18px 0 16px",
          background: "rgba(255,255,255,0.80)",
          backdropFilter: "blur(16px)",
          borderRadius: "20px",
          border: "2px solid rgba(201,194,245,0.45)",
          boxShadow: "0 4px 24px #c9b4f522",
          padding: "10px",
          display: "flex",
          gap: "6px",
          animation: "fadeUp 0.5s 0.1s ease both",
          opacity: 0,
          animationFillMode: "forwards",
        }}>
          {filters.map((f) => (
            <button
              key={f.key}
              className="filter-btn"
              onClick={() => setFilter(f.key)}
              style={{
                flex: 1,
                padding: "8px 4px",
                borderRadius: "13px",
                border: "none",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                background: filter === f.key
                  ? "linear-gradient(135deg, #7f77dd, #a78bfa)"
                  : "transparent",
                color: filter === f.key ? "white" : "#b0a8e8",
                boxShadow: filter === f.key ? "0 2px 10px #7f77dd40" : "none",
              }}
            >
              <span style={{ fontSize: "14px" }}>{f.emoji}</span>
              {f.label}
            </button>
          ))}
        </div>

        {/* 내역 목록 */}
        {Object.keys(grouped).length === 0 ? (
          <div style={{
            textAlign: "center", padding: "56px 0",
            animation: "fadeUp 0.5s 0.2s ease both", opacity: 0, animationFillMode: "forwards",
          }}>
            <div style={{ fontSize: 40, marginBottom: 10, animation: "float0 2.5s ease-in-out infinite" }}>🐾</div>
            <div style={{ fontSize: "13px", color: "#b0a8e8", fontWeight: 700 }}>내역이 없어요</div>
            <div style={{ fontSize: "11px", color: "#cfc8f0", marginTop: 4 }}>첫 번째 내역을 추가해보세요</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {Object.entries(grouped).map(([date, txs], gi) => {
              const dayNet =
                txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) -
                txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
              return (
                <div key={date} style={{
                  animation: `fadeUp 0.5s ${0.2 + gi * 0.07}s ease both`,
                  opacity: 0, animationFillMode: "forwards",
                }}>
                  {/* 날짜 헤더 */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <div style={{
                      background: "linear-gradient(135deg, #7f77dd, #a78bfa)",
                      borderRadius: "10px", padding: "3px 10px",
                      fontSize: "10px", fontWeight: 800, color: "white",
                      whiteSpace: "nowrap", boxShadow: "0 2px 8px #7f77dd30",
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
                            fontSize: "13px", fontWeight: 800, color: "#3C3489",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {tx.description}
                          </div>
                          <div style={{ fontSize: "10px", color: "#b0a8e8", marginTop: "2px" }}>
                            {tx.paidBy === "me" ? "🐰 나" : tx.paidBy === "partner" ? "🐻 짝꿍" : "💕 같이"} · {tx.category}
                          </div>
                        </div>
                        <div style={{
                          fontSize: "13px", fontWeight: 900,
                          color: tx.type === "expense" ? "#d4537e" : "#3B8C3B",
                          whiteSpace: "nowrap",
                        }}>
                          {tx.type === "expense" ? "-" : "+"}{tx.amount.toLocaleString()}원
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default TransactionPage;