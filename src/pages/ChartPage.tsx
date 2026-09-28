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
import { theme } from "../theme";

interface CategoryStats {
  category: string;
  amount: number;
  percentage: number;
}

const COLORS = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#312e81"];

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
      fill={theme.textMuted}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize="11"
      fontWeight="600"
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
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(new Date());

  const formatMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const loadChartData = async (userId: string, selectedMonth: string) => {
    setLoading(true);
    setError(null);
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
    } catch (err) {
      console.error("차트 데이터 로드 실패:", err);
      setError(err instanceof Error ? `[${(err as any).code ?? "error"}] ${err.message}` : String(err));
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
        background: theme.bg,
        maxWidth: "400px",
        margin: "0 auto",
        paddingBottom: "180px",
      }}
    >

      <div style={{
        background: theme.surface,
        padding: "20px",
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: theme.text }}>통계</div>
        <div style={{ fontSize: "12px", fontWeight: 500, color: theme.textMuted }}>월별 지출/수입 분석</div>
      </div>

      <div style={{ padding: "16px" }}>
        <div style={{ marginBottom: "20px" }}>
          <MonthNavigator month={month} onChange={setMonth} />
        </div>

        {error && (
          <div style={{
            background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b",
            borderRadius: theme.radiusMd, padding: "12px", marginBottom: "20px",
            fontSize: "12px", fontWeight: 600, wordBreak: "break-all",
          }}>
            데이터 로드 실패: {error}
          </div>
        )}

        {/* 수입/지출 요약 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div
            style={{
              background: theme.surface,
              color: theme.text,
              padding: "16px",
              borderRadius: theme.radiusMd,
              textAlign: "center",
              border: `1px solid ${theme.border}`,
            }}
          >
            <p style={{ fontSize: "11px", fontWeight: 600, color: theme.textMuted, marginBottom: "6px" }}>수입</p>
            <p style={{ fontSize: "17px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>₩{totalIncome.toLocaleString()}</p>
          </div>
          <div
            style={{
              background: theme.surface,
              color: theme.text,
              padding: "16px",
              borderRadius: theme.radiusMd,
              textAlign: "center",
              border: `1px solid ${theme.border}`,
            }}
          >
            <p style={{ fontSize: "11px", fontWeight: 600, color: theme.textMuted, marginBottom: "6px" }}>지출</p>
            <p style={{ fontSize: "17px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>₩{totalExpense.toLocaleString()}</p>
          </div>
        </div>

        {/* 지출 차트 */}
        <div style={{ background: theme.surface, borderRadius: theme.radiusMd, padding: "16px", marginBottom: "20px", border: `1px solid ${theme.border}` }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", color: theme.text }}>
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
                      nameKey="category"
                    >
                      {expenseStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `₩${(value as number).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: "16px" }}>
                {expenseStats.map((stat, index) => (
                  <div key={stat.category} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span style={{ fontSize: "13px", color: theme.textMuted }}>{stat.category}</span>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: theme.text, fontVariantNumeric: "tabular-nums" }}>₩{stat.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ textAlign: "center", color: theme.textFaint, fontWeight: 600, padding: "40px 0" }}>이 달의 지출이 없습니다</p>
          )}
        </div>

        {/* 수입 차트 */}
        <div style={{ background: theme.surface, borderRadius: theme.radiusMd, padding: "16px", marginBottom: "20px", border: `1px solid ${theme.border}` }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", color: theme.text }}>
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
                      nameKey="category"
                    >
                      {incomeStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `₩${(value as number).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: "16px" }}>
                {incomeStats.map((stat, index) => (
                  <div key={stat.category} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span style={{ fontSize: "13px", color: theme.textMuted }}>{stat.category}</span>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: theme.text, fontVariantNumeric: "tabular-nums" }}>₩{stat.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ textAlign: "center", color: theme.textFaint, fontWeight: 600, padding: "40px 0" }}>이 달의 수입이 없습니다</p>
          )}
        </div>
      </div>
      <div style={{ height: "140px" }} />
      <BottomNav />
    </div>
  );
};

export default ChartPage;