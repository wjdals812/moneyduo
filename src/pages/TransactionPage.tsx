import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import type { Transaction } from "../types/index";
import { theme } from "../theme";

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

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "me", label: "나" },
    { key: "partner", label: "짝꿍" },
    { key: "together", label: "같이" }
  ];

  return (
    <div style={{
      minHeight: "100svh",
      background: theme.bg,
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "180px",
    }}>

      {/* 헤더 */}
      <div style={{
        background: theme.surface,
        padding: "20px",
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: theme.text }}>내역</div>
        <div style={{ fontSize: "12px", fontWeight: 500, color: theme.textMuted }}>우리 둘의 소비 기록</div>
      </div>

      <div style={{ padding: "16px" }}>

        {/* 필터 탭 */}
        <div style={{
          marginBottom: "16px",
          background: theme.surface,
          borderRadius: theme.radiusMd,
          border: `1px solid ${theme.border}`,
          padding: "4px",
          display: "flex",
          gap: "4px",
        }}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                flex: 1,
                padding: "8px 4px",
                borderRadius: theme.radiusSm,
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                background: filter === f.key ? theme.accent : "transparent",
                color: filter === f.key ? "white" : theme.textMuted,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 내역 목록 */}
        {Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 0" }}>
            <div style={{ fontSize: "13px", color: theme.textMuted, fontWeight: 600 }}>내역이 없어요</div>
            <div style={{ fontSize: "11px", color: theme.textFaint, marginTop: 4 }}>처음 내역을 추가해보세요</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {Object.entries(grouped).map(([date, txs]) => {
              const dayNet =
                txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) -
                txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
              return (
                <div key={date}>
                  {/* 날짜 헤더 */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <div style={{ color: theme.textMuted, fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {formatDate(date)}
                    </div>
                    <div style={{ flex: 1, height: "1px", background: theme.border }} />
                    <span style={{
                      fontSize: "11px", fontWeight: 600,
                      color: dayNet >= 0 ? theme.success : theme.danger,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {dayNet >= 0 ? "+" : ""}{dayNet.toLocaleString()}원
                    </span>
                  </div>

                  {/* 내역 카드들 */}
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
                        <div style={{ fontSize: "18px", flexShrink: 0, width: "24px", textAlign: "center" }}>
                          {tx.category.split(" ")[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: "13px", fontWeight: 600, color: theme.text,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {tx.description}
                          </div>
                          <div style={{ fontSize: "11px", fontWeight: 500, color: theme.textMuted, marginTop: "2px" }}>
                            {tx.paidBy === "me" ? "나" : tx.paidBy === "partner" ? "짝꿍" : "같이"} · {tx.category}
                          </div>
                        </div>
                        <div style={{
                          fontSize: "13px", fontWeight: 700,
                          color: tx.type === "expense" ? theme.danger : theme.success,
                          whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
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
      <div style={{ height: "140px" }} />
      <BottomNav />
    </div>
  );
};

export default TransactionPage;
