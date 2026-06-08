import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import type { Transaction } from "../types/index";

type FilterType = "all" | "me" | "together" | "partner";

const TransactionPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [uid, setUid] = useState("");

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
    { key: "together", label: "같이" },
    { key: "partner", label: "짝꿍" },
  ];

  return (
    <div className="min-h-screen bg-[#faf9ff] max-w-[400px] mx-auto font-sans pb-24">
      <div className="bg-[#7f77dd] px-5 pt-6 pb-8 rounded-b-[28px]">
        <div className="text-lg font-extrabold text-white">내역</div>
      </div>

      <div className="px-4 mt-4">
        <div className="flex gap-2 mb-4">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer border-2 transition-colors ${filter === f.key ? "border-[#7f77dd] bg-[#eeedfe] text-[#534AB7]" : "border-[#c9c2f5] bg-white text-[#afa9ec]"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="text-[#afa9ec] text-sm text-center mt-20">
            내역이 없어요 😊
          </div>
        ) : (
          Object.entries(grouped).map(([date, txs]) => (
            <div key={date} className="mb-4">
              <div className="text-xs font-bold text-[#8882cc] mb-2">{date}</div>
              <div className="flex flex-col gap-2">
                {txs.map((tx) => (
                  <div key={tx.id} className="bg-white rounded-2xl border-2 border-[#c9c2f5] p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#eeedfe] flex items-center justify-center text-base shrink-0">
                      {tx.category.split(" ")[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#3C3489]">{tx.description}</div>
                      <div className="text-[11px] text-[#afa9ec] mt-0.5">
                        {tx.paidBy === "me" ? "나" : tx.paidBy === "partner" ? "짝꿍" : "같이"} · {tx.category}
                      </div>
                    </div>
                    <div className={`text-sm font-extrabold ${tx.type === "expense" ? "text-[#d4537e]" : "text-[#3B6D11]"}`}>
                      {tx.type === "expense" ? "-" : "+"}{tx.amount.toLocaleString()}원
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default TransactionPage;