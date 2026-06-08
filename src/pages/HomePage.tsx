import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import type { Transaction } from "../types/index";

const HomePage = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserName(user.displayName || "");
        const q = query(
          collection(db, "transactions"),
          where("createdBy", "==", user.uid),
          orderBy("date", "desc"),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        setTransactions(data);
        const total = data
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + t.amount, 0);
        setTotalExpense(total);
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

  return (
    <div className="min-h-screen bg-[#faf9ff] max-w-[400px] mx-auto font-sans">
      <div className="bg-[#7f77dd] px-5 pt-6 pb-8 rounded-b-[28px] mb-4">
        <div className="text-xs text-[#c9c5f5] font-bold">{monthLabel}</div>
        <div className="text-2xl font-extrabold text-white mt-0.5">MoneyDuo 💜</div>
        <div className="text-xs text-[#c9c5f5]">안녕하세요, {userName}님!</div>
        <button
          onClick={handleLogout}
          className="mt-3 bg-transparent border border-[#c9c5f5] rounded-lg text-[#c9c5f5] text-xs px-3 py-1 cursor-pointer"
        >
          로그아웃
        </button>
      </div>

      <div className="px-4">
        <div className="bg-white rounded-[20px] border-2 border-[#c9c2f5] p-4 mb-3">
          <div className="text-[11px] text-[#8882cc] font-bold mb-2">이번 달 총 지출</div>
          <div className="text-[26px] font-extrabold text-[#534AB7]">
            {totalExpense.toLocaleString()}원
          </div>
        </div>

        <div className="text-sm font-extrabold text-[#534AB7] my-3">최근 내역</div>

        {transactions.length === 0 ? (
          <div className="text-[#afa9ec] text-sm text-center mt-10">
            아직 내역이 없어요 😊
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-white rounded-2xl border-2 border-[#c9c2f5] p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#eeedfe] flex items-center justify-center text-base shrink-0">
                  {tx.category.split(" ")[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#3C3489]">{tx.description}</div>
                  <div className="text-[11px] text-[#afa9ec] mt-0.5">
                    {tx.paidBy === "me" ? "나" : tx.paidBy === "partner" ? "파트너" : "같이"} · {tx.date}
                  </div>
                </div>
                <div className={`text-sm font-extrabold ${tx.type === "expense" ? "text-[#d4537e]" : "text-[#3B6D11]"}`}>
                  {tx.type === "expense" ? "-" : "+"}{tx.amount.toLocaleString()}원
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate("/add")}
        className="fixed bottom-24 right-6 w-12 h-12 rounded-full bg-[#7f77dd] border-none text-white cursor-pointer shadow-lg flex items-center justify-center"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <BottomNav />
    </div>
  );
};

export default HomePage;