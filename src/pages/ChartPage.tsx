import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import BottomNav from "../components/BottomNav";
import MonthNavigator from "../components/MonthNavigator";
import coupleService from "../services/coupleService";
import type { Transaction } from "../types/index";

interface CategoryStats {
  category: string;
  amount: number;
  percentage: number;
}

const COLORS = ["#7f77dd", "#a78bfa", "#c9a8e8", "#e9e4ff", "#9f8fd6", "#6d5fcc"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderCustomLabel = (props: any, data: CategoryStats[]) => {
  const { cx, cy, midAngle, outerRadius, index } = props;
  const stat = data[index];

  if (!stat) return null;

  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 10; // 라벨을 차트에 더 가깝게
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#5a4632"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize="11"
      fontWeight="700"
    >
      {`${stat.category} ${stat.percentage}%`}
    </text>
  );
};

const ChartPage = () => {
  const navigate = useNavigate();
  const [expenseStats, setExpenseStats] = useState<CategoryStats[]>([]);
  const [incomeStats, setIncomeStats] = useState<CategoryStats[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<Date>(new Date());

  const formatMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const loadChartData = async (userId: string, selectedMonth: string) => {
    setLoading(true);
    try {
      // 내가 작성한 내역 + (커플 연결 중이면) 파트너가 작성한 내역까지 조회
      const myCouple = await coupleService.getMyCouple(userId);
      const snapshots = await Promise.all([
        getDocs(query(collection(db, "transactions"), where("createdBy", "==", userId), orderBy("date", "desc"), limit(300))),
        ...(myCouple
          ? [getDocs(query(collection(db, "transactions"), where("coupleId", "==", myCouple.id), orderBy("date", "desc"), limit(300)))]
          : []),
      ]);

      const seen = new Set<string>();
      const transactions: Transaction[] = [];
      for (const snap of snapshots) {
        for (const d of snap.docs) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          transactions.push({ id: d.id, ...d.data() } as Transaction);
        }
      }

      // 선택된 월의 거래만 필터링
      const monthTransactions = transactions.filter((t) =>
        t.date.startsWith(selectedMonth)
      );

      // 지출과 수입 분리
      const expenses = monthTransactions.filter((t) => t.type === "expense");
      const incomes = monthTransactions.filter((t) => t.type === "income");

      // 지출 통계
      const expenseMap = new Map<string, number>();
      expenses.forEach((t) => {
        const current = expenseMap.get(t.category) || 0;
        expenseMap.set(t.category, current + t.amount);
      });

      // 수입 통계
      const incomeMap = new Map<string, number>();
      incomes.forEach((t) => {
        const current = incomeMap.get(t.category) || 0;
        incomeMap.set(t.category, current + t.amount);
      });

      // 합계 계산
      const totalExp = Array.from(expenseMap.values()).reduce((a, b) => a + b, 0);
      const totalInc = Array.from(incomeMap.values()).reduce((a, b) => a + b, 0);

      setTotalExpense(totalExp);
      setTotalIncome(totalInc);

      // 통계 데이터 포맷팅
      const expenseStats: CategoryStats[] = Array.from(expenseMap).map(([category, amount]) => ({
        category,
        amount,
        percentage: Math.round((amount / totalExp) * 100) || 0,
      }));

      const incomeStats: CategoryStats[] = Array.from(incomeMap).map(([category, amount]) => ({
        category,
        amount,
        percentage: Math.round((amount / totalInc) * 100) || 0,
      }));

      setExpenseStats(expenseStats.sort((a, b) => b.amount - a.amount));
      setIncomeStats(incomeStats.sort((a, b) => b.amount - a.amount));
    } catch (error) {
      console.error("차트 데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadChartData(user.uid, formatMonthKey(month));
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate, month]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">로딩 중...</div>;
  }

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "#f5f3ff",
        maxWidth: "400px",
        margin: "0 auto",
        paddingBottom: "180px",
      }}
    >

      <div style={{
        background: "#ffffff",
        padding: "28px 20px 36px",
        borderRadius: "0 0 32px 32px",
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        borderBottom: "2px dashed rgba(196, 196, 196, 0.28)",
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
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#3C3489" }}>통계</div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#b0a8e8", opacity: 0.85 }}>월별 지출/수입 분석</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ marginBottom: "30px" }}>
          <MonthNavigator month={month} onChange={setMonth} />
        </div>

        {/* 수입/지출 요약 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "30px" }}>
          <div
            style={{
              background: "#ffffff",
              color: "#334155",
              padding: "20px",
              borderRadius: "18px",
              textAlign: "center",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              boxShadow: "0 6px 16px rgba(71, 85, 105, 0.08)",
            }}
          >
            <p style={{ fontSize: "12px", fontWeight: "800", opacity: 0.9, marginBottom: "8px" }}>수입</p>
            <p style={{ fontSize: "20px", fontWeight: "900" }}>₩{totalIncome.toLocaleString()}</p>
          </div>
          <div
            style={{
              background: "#ffffff",
              color: "#334155",
              padding: "20px",
              borderRadius: "18px",
              textAlign: "center",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              boxShadow: "0 6px 16px rgba(71, 85, 105, 0.08)",
            }}
          >
            <p style={{ fontSize: "12px", fontWeight: "800", opacity: 0.9, marginBottom: "8px" }}>지출</p>
            <p style={{ fontSize: "20px", fontWeight: "900" }}>₩{totalExpense.toLocaleString()}</p>
          </div>
        </div>

        {/* 지출 차트 */}
        <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", marginBottom: "30px", boxShadow: "0 8px 24px rgba(71,85,105,0.08)", border: "1px solid rgba(148, 163, 184, 0.18)" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", color: "#2D3436" }}>
            지출 분석
          </h2>
          {expenseStats.length > 0 ? (
            <>
              <div style={{ width: "100%", overflow: "hidden" }}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={expenseStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props) => renderCustomLabel(props, expenseStats)}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {expenseStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `₩${(value as number).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: "20px" }}>
                {expenseStats.map((stat, index) => (
                  <div key={stat.category} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0F0F0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span style={{ fontSize: "14px", color: "#666" }}>{stat.category}</span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#2D3436" }}>₩{stat.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ textAlign: "center", color: "#999", fontWeight: "800", padding: "40px 0" }}>이 달의 지출이 없습니다</p>
          )}
        </div>

        {/* 수입 차트 */}
        <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", marginBottom: "30px", boxShadow: "0 8px 24px rgba(71,85,105,0.08)", border: "1px solid rgba(148, 163, 184, 0.18)" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", color: "#2D3436" }}>
            수입 분석
          </h2>
          {incomeStats.length > 0 ? (
            <>
              <div style={{ width: "100%", overflow: "hidden" }}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={incomeStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props) => renderCustomLabel(props, incomeStats)}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {incomeStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `₩${(value as number).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: "20px" }}>
                {incomeStats.map((stat, index) => (
                  <div key={stat.category} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0F0F0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span style={{ fontSize: "14px", color: "#666" }}>{stat.category}</span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#2D3436" }}>₩{stat.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ textAlign: "center", color: "#999", fontWeight: "800", padding: "40px 0" }}>이 달의 수입이 없습니다</p>
          )}
        </div>
      </div>
      <div style={{ height: "140px" }} />
      <BottomNav />
    </div>
  );
};

export default ChartPage;