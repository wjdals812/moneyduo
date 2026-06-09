import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import BottomNav from "../components/BottomNav";
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
      const q = query(
        collection(db, "transactions"),
        where("createdBy", "==", userId)
      );
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Transaction[];

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

  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 9 }, (_, i) => currentYear - 4 + i);

  const handlePrevMonth = () => {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectMonth = (selectedMonth: number) => {
    setMonth((prev) => new Date(prev.getFullYear(), selectedMonth - 1, 1));
    setShowMonthPicker(false);
  };

  const handleSelectYear = (selectedYear: number) => {
    setMonth((prev) => new Date(selectedYear, prev.getMonth(), 1));
  };

  const toggleMonthPicker = () => {
    setShowMonthPicker((prev) => !prev);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">로딩 중...</div>;
  }

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "linear-gradient(180deg, #fbf3e7 0%, #f7efe3 10%, #fdf9f4 100%)",
        backgroundImage: "repeating-linear-gradient(180deg, transparent, transparent 28px, rgba(190, 155, 110, 0.05) 29px, transparent 30px)",
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
          <div style={{ color: "#5d4732" }}>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>통계</div>
            <div style={{ fontSize: "12px", opacity: 0.85 }}>월별 지출/수입 분석</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ marginBottom: "30px" }}>
          <div style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "48px minmax(0, 1fr) 48px",
            alignItems: "center",
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid rgba(148, 163, 184, 0.16)",
            padding: "12px 16px",
            gap: "12px",
            minWidth: 0,
          }}>
            <button onClick={handlePrevMonth} style={{
              all: "unset",
              cursor: "pointer",
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "#f4f6f8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4b5563",
              fontSize: "18px",
              boxShadow: "0 2px 8px rgba(71, 85, 105, 0.08)",
            }}>‹</button>
            <button onClick={toggleMonthPicker} style={{
              all: "unset",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              minWidth: 0,
              padding: "10px 12px",
              borderRadius: "14px",
              background: "#f8fafc",
              color: "#334155",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid rgba(127, 119, 221, 0.3)",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {month.getFullYear()}년 {month.getMonth() + 1}월
              <span style={{ marginLeft: "8px", color: "#475569" }}>▾</span>
            </button>
            <button onClick={handleNextMonth} style={{
              all: "unset",
              cursor: "pointer",
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "#f4f6f8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4b5563",
              fontSize: "18px",
              boxShadow: "0 2px 8px rgba(71, 85, 105, 0.08)",
            }}>›</button>
            {showMonthPicker && (
              <div style={{
                position: "absolute",
                left: "50%",
                top: "110%",
                transform: "translateX(-50%)",
                width: "calc(100% - 16px)",
                background: "#ffffff",
                borderRadius: "20px",
                border: "1px solid rgba(148, 163, 184, 0.16)",
                boxShadow: "0 18px 50px rgba(71, 85, 105, 0.08)",
                padding: "18px",
                zIndex: 10,
              }}>
                <div style={{ marginBottom: "12px", fontSize: "13px", color: "#6b6b6b", fontWeight: 700 }}>
                  연도 선택
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                  {yearOptions.map((year) => (
                    <button key={year} onClick={() => handleSelectYear(year)} style={{
                      all: "unset",
                      cursor: "pointer",
                      padding: "10px 14px",
                      borderRadius: "14px",
                      background: year === month.getFullYear() ? "#7A6FA8" : "#f8fafc",
                      color: year === month.getFullYear() ? "white" : "#475569",
                      fontWeight: 700,
                      fontSize: "13px",
                    }}>
                      {year}년
                    </button>
                  ))}
                </div>
                <div style={{ marginBottom: "12px", fontSize: "13px", color: "#6b6b6b", fontWeight: 700 }}>
                  월 선택
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <button key={m} onClick={() => handleSelectMonth(m)} style={{
                      all: "unset",
                      cursor: "pointer",
                      padding: "10px 0",
                      borderRadius: "12px",
                      background: m === month.getMonth() + 1 ? "#7A6FA8" : "#f8fafc",
                      border: "1px solid rgba(155, 142, 196, 0.3)",
                      color: m === month.getMonth() + 1 ? "white" : "#475569",
                      fontSize: "13px",
                      textAlign: "center",
                    }}>
                      {m}월
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
            <p style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px" }}>수입</p>
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
            <p style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px" }}>지출</p>
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
            <p style={{ textAlign: "center", color: "#999", padding: "40px 0" }}>이 달의 지출이 없습니다</p>
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
            <p style={{ textAlign: "center", color: "#999", padding: "40px 0" }}>이 달의 수입이 없습니다</p>
          )}
        </div>
      </div>
      <div style={{ height: "140px" }} />
      <BottomNav />
    </div>
  );
};

export default ChartPage;