import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../firebase";

const defaultCategories = ["🍜 식비", "☕ 카페", "🎬 문화", "🚌 교통", "🛍️ 쇼핑", "💊 의료", "🏠 생활", "💑 데이트", "기타"];


const EditTransactionPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("🍜 식비");
  const [paidBy, setPaidBy] = useState<"me" | "partner" | "together">("me");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState("");
  const [categories, setCategories] = useState<string[]>(defaultCategories);

  // 다른 useEffect 옆에 추가
  useEffect(() => {
  const fetchCategories = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, "userSettings", uid);
    const snapshot = await getDoc(ref);
    if (snapshot.exists() && snapshot.data().categories) {
      setCategories(snapshot.data().categories);
    }
  };
  fetchCategories();
}, []);

useEffect(() => {
  const fetchData = async () => {
    if (!id) return;
    const docRef = doc(db, "transactions", id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      setAmount(String(data.amount));
      setDescription(data.description);
      setCategory(data.category);
      setPaidBy(data.paidBy);
      setType(data.type);
      setDate(data.date);
    }
  };
  fetchData();
}, [id]);

  const handleUpdate = async () => {
    if (!amount || !description) {
      alert("금액과 내용을 입력해주세요!");
      return;
    }
    try {
      const docRef = doc(db, "transactions", id!);
      await updateDoc(docRef, {
        amount: Number(amount),
        description,
        category,
        paidBy,
        type,
        date,
        updatedAt: new Date(),
      });
      navigate("/home");
    } catch (error) {
      console.error("수정 실패:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9ff] max-w-[400px] mx-auto font-sans">
      <div className="bg-[#7f77dd] px-5 pt-6 pb-8 rounded-b-[28px] flex items-center gap-3">
        <button onClick={() => navigate("/home")} className="bg-transparent border-none text-white text-xl cursor-pointer">←</button>
        <div className="text-lg font-extrabold text-white">내역 수정</div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* 지출/수입 */}
        <div className="flex gap-2">
          <button onClick={() => setType("expense")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-2 transition-colors ${type === "expense" ? "border-[#7f77dd] bg-[#eeedfe] text-[#534AB7]" : "border-[#c9c2f5] bg-white text-[#afa9ec]"}`}>
            지출
          </button>
          <button onClick={() => setType("income")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-2 transition-colors ${type === "income" ? "border-[#7f77dd] bg-[#eeedfe] text-[#534AB7]" : "border-[#c9c2f5] bg-white text-[#afa9ec]"}`}>
            수입
          </button>
        </div>

        {/* 금액 */}
        <div>
          <div className="text-xs text-[#8882cc] font-bold mb-1.5">금액</div>
          <input type="number" placeholder="0" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-[#c9c2f5] text-xl font-extrabold text-[#534AB7] outline-none bg-white" />
        </div>

        {/* 내용 */}
        <div>
          <div className="text-xs text-[#8882cc] font-bold mb-1.5">내용</div>
          <input type="text" placeholder="어디서 썼나요?" value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-[#c9c2f5] text-sm outline-none bg-white" />
        </div>

        {/* 카테고리 UI */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <div className="text-xs text-[#8882cc] font-bold">카테고리</div>
            <button
              onClick={() => navigate("/categories")}
              className="text-xs text-[#7f77dd] font-bold bg-[#eeedfe] border border-[#c9c2f5] rounded-lg px-2 py-1 cursor-pointer"
            >
              관리 ⚙️
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer border-2 transition-colors ${category === cat ? "border-[#7f77dd] bg-[#eeedfe] text-[#534AB7]" : "border-[#c9c2f5] bg-white text-[#888]"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 누가 */}
        <div>
          <div className="text-xs text-[#8882cc] font-bold mb-1.5">누가 썼나요?</div>
          <div className="flex gap-2">
            {(["me", "together", "partner"] as const).map((p) => (
              <button key={p} onClick={() => setPaidBy(p)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-2 transition-colors ${paidBy === p ? "border-[#7f77dd] bg-[#eeedfe] text-[#534AB7]" : "border-[#c9c2f5] bg-white text-[#afa9ec]"}`}>
                {p === "me" ? "나" : p === "together" ? "같이" : "짝꿍"}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜 */}
        <div>
          <div className="text-xs text-[#8882cc] font-bold mb-1.5">날짜</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-[#c9c2f5] text-sm outline-none bg-white" />
        </div>

        <button onClick={handleUpdate}
          className="w-full py-4 rounded-2xl bg-[#7f77dd] text-white text-base font-extrabold cursor-pointer mt-2">
          수정하기 💜
        </button>
      </div>
    </div>
  );
};

export default EditTransactionPage;