import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

const defaultCategories = ["🍜 식비", "☕ 카페", "🎬 문화", "🚌 교통", "🛍️ 쇼핑", "💊 의료", "🏠 생활", "💑 데이트", "기타"];

const CategoriesPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [newCategory, setNewCategory] = useState("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const ref = doc(db, "userSettings", uid);
      const snapshot = await getDoc(ref);
      if (snapshot.exists() && snapshot.data().categories) {
        setCategories(snapshot.data().categories);
      }
    };
    fetch();
  }, []);

  const save = async (updated: string[]) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(doc(db, "userSettings", uid), { categories: updated }, { merge: true });
  };

  const handleAdd = async () => {
    if (!newCategory.trim()) return;
    const updated = [...categories, newCategory];
    setCategories(updated);
    await save(updated);
    setNewCategory("");
    setShowInput(false);
  };

  const handleDelete = async (cat: string) => {
    const updated = categories.filter((c) => c !== cat);
    setCategories(updated);
    await save(updated);
  };

  return (
    <div className="min-h-screen bg-[#faf9ff] max-w-[400px] mx-auto font-sans">
      <div className="bg-[#7f77dd] px-5 pt-6 pb-8 rounded-b-[28px] flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="bg-transparent border-none text-white text-xl cursor-pointer">←</button>
        <div className="text-lg font-extrabold text-white">카테고리 관리</div>
      </div>

      <div className="p-5 flex flex-col gap-3">
        {categories.map((cat) => (
          <div key={cat} className="flex items-center justify-between bg-white border-2 border-[#ede9fe] rounded-2xl px-4 py-3">
            <span className="text-sm font-bold text-[#3C3489]">{cat}</span>
            <button
              onClick={() => handleDelete(cat)}
              className="text-xs text-[#d4537e] font-bold bg-[#fff0f6] border border-[#f9c0d4] rounded-lg px-3 py-1 cursor-pointer"
            >
              삭제
            </button>
          </div>
        ))}

        {showInput ? (
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              placeholder="예: 🎮 게임"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1 px-4 py-3 rounded-2xl border-2 border-[#7f77dd] text-sm outline-none bg-white"
              autoFocus
            />
            <button onClick={handleAdd} className="px-4 py-3 rounded-2xl bg-[#7f77dd] text-white text-sm font-bold cursor-pointer">추가</button>
            <button onClick={() => { setShowInput(false); setNewCategory(""); }} className="px-4 py-3 rounded-2xl border-2 border-[#c9c2f5] text-sm font-bold cursor-pointer bg-white text-[#aaa]">취소</button>
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-[#c9c2f5] text-sm font-bold text-[#aaa] cursor-pointer bg-white mt-1"
          >
            + 카테고리 추가
          </button>
        )}
      </div>
    </div>
  );
};

export default CategoriesPage;