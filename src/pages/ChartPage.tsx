import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, limit, getDocs, getDoc, setDoc, doc } from "firebase/firestore";
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
      style={{ fontSize: "12px", fontWeight: 500 }}
    >
      {`${stat.category.split(" ")[0]} ${stat.percentage}%`}
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
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [categoryBudgetInputs, setCategoryBudgetInputs] = useState<Record<string, string>>({});

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

  const loadBudget = async (userId: string) => {
    const snap = await getDoc(doc(db, "userSettings", userId));
    if (snap.exists()) {
      const data = snap.data();
      setMonthlyBudget(data.monthlyBudget ?? null);
      setCategoryBudgets(data.categoryBudgets ?? {});
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await Promise.all([loadChartData(user.uid, formatMonthKey(month)), loadBudget(user.uid)]);
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate, month]);

  const openBudgetForm = () => {
    setBudgetInput(monthlyBudget != null ? String(monthlyBudget) : "");
    const inputs: Record<string, string> = {};
    expenseStats.forEach((s) => {
      inputs[s.category] = categoryBudgets[s.category] != null ? String(categoryBudgets[s.category]) : "";
    });
    setCategoryBudgetInputs(inputs);
    setShowBudgetForm(true);
  };

  const saveBudget = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const overall = budgetInput.trim() ? Number(budgetInput) : null;
    const perCategory: Record<string, number> = {};
    for (const [cat, val] of Object.entries(categoryBudgetInputs)) {
      if (val.trim()) perCategory[cat] = Number(val);
    }
    await setDoc(doc(db, "userSettings", uid), { monthlyBudget: overall, categoryBudgets: perCategory }, { merge: true });
    setMonthlyBudget(overall);
    setCategoryBudgets(perCategory);
    setShowBudgetForm(false);
  };

  const budgetBarColor = (pct: number) => (pct >= 100 ? theme.danger : pct >= 80 ? "#d97706" : theme.accent);

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
        paddingBottom: "90px",
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

        {/* 예산 */}
        <div style={{ background: theme.surface, borderRadius: theme.radiusMd, border: `1px solid ${theme.border}`, padding: "16px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: monthlyBudget || showBudgetForm ? "12px" : 0 }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: theme.text }}>예산</h2>
            <button
              onClick={() => (showBudgetForm ? setShowBudgetForm(false) : openBudgetForm())}
              style={{
                fontSize: "11px", fontWeight: 600, color: theme.accent,
                background: theme.accentMuted, border: "none",
                borderRadius: theme.radiusSm, padding: "5px 10px", cursor: "pointer",
              }}
            >
              예산 설정
            </button>
          </div>

          {!showBudgetForm && monthlyBudget != null && monthlyBudget > 0 && (() => {
            const pct = Math.round((totalExpense / monthlyBudget) * 100);
            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: theme.textMuted }}>이번 달 예산 사용률</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: budgetBarColor(pct) }}>{pct}%</span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: theme.surfaceMuted, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: budgetBarColor(pct) }} />
                </div>
              </div>
            );
          })()}

          {showBudgetForm && (
            <div style={{ background: theme.surfaceMuted, borderRadius: theme.radiusMd, padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: theme.textMuted, display: "block", marginBottom: "4px" }}>전체 월 예산</label>
                <input
                  type="number"
                  placeholder="예: 1500000"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`, fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
              {expenseStats.map((s) => (
                <div key={s.category}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: theme.textMuted, display: "block", marginBottom: "4px" }}>{s.category} 한도</label>
                  <input
                    type="number"
                    placeholder="미설정"
                    value={categoryBudgetInputs[s.category] ?? ""}
                    onChange={(e) => setCategoryBudgetInputs((prev) => ({ ...prev, [s.category]: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`, fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                <button onClick={saveBudget} style={{ flex: 1, padding: "9px", borderRadius: theme.radiusSm, background: theme.accent, color: "white", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer" }}>저장</button>
                <button onClick={() => setShowBudgetForm(false)} style={{ padding: "9px 14px", borderRadius: theme.radiusSm, background: theme.surface, color: theme.textMuted, fontSize: "12px", fontWeight: 600, border: `1px solid ${theme.border}`, cursor: "pointer" }}>취소</button>
              </div>
            </div>
          )}
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
                  <PieChart accessibilityLayer={false}>
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
                      rootTabIndex={-1}
                    >
                      {expenseStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `₩${(value as number).toLocaleString()}`}
                      contentStyle={{ fontSize: "11px", padding: "6px 10px", borderRadius: theme.radiusSm }}
                      itemStyle={{ fontSize: "11px", padding: 0 }}
                      labelStyle={{ display: "none" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: "16px" }}>
                {expenseStats.map((stat, index) => {
                  const limit = categoryBudgets[stat.category];
                  const pct = limit ? Math.round((stat.amount / limit) * 100) : null;
                  return (
                    <div key={stat.category} style={{ padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span style={{ fontSize: "13px", color: theme.textMuted }}>{stat.category}</span>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: theme.text, fontVariantNumeric: "tabular-nums" }}>
                          ₩{stat.amount.toLocaleString()}{limit ? ` / ₩${limit.toLocaleString()}` : ""}
                        </span>
                      </div>
                      {pct !== null && (
                        <div style={{ height: "4px", borderRadius: "2px", background: theme.surfaceMuted, overflow: "hidden", marginTop: "6px" }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: budgetBarColor(pct) }} />
                        </div>
                      )}
                    </div>
                  );
                })}
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
                  <PieChart accessibilityLayer={false}>
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
                      rootTabIndex={-1}
                    >
                      {incomeStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `₩${(value as number).toLocaleString()}`}
                      contentStyle={{ fontSize: "11px", padding: "6px 10px", borderRadius: theme.radiusSm }}
                      itemStyle={{ fontSize: "11px", padding: 0 }}
                      labelStyle={{ display: "none" }}
                    />
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
      <BottomNav />
    </div>
  );
};

export default ChartPage;