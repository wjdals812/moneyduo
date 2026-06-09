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
    <div style={{
      minHeight: "100svh",
      background: "#f5f3ff",
      maxWidth: "400px",
      margin: "0 auto",
    }}>

      <div style={{
        background: "#ffffff",
        padding: "28px 20px 36px",
        borderRadius: "0 0 32px 32px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: "#f2f0fa",
          border: "1.5px solid rgba(155, 142, 196, 0.3)",
          borderRadius: "12px",
          color: "#7A6FA8",
          fontSize: "16px",
          width: "36px", height: "36px",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div style={{ fontSize: "18px", fontWeight: 800, color: "#5a4e7a" }}>카테고리 관리 🏷️</div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {categories.map((cat) => (
          <div key={cat} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(8px)",
            borderRadius: "16px",
            border: "1.5px solid rgba(201,194,245,0.4)",
            padding: "14px 16px",
            boxShadow: "0 2px 12px #c9b4f518",
          }}>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#3C3489" }}>{cat}</span>
            <button onClick={() => handleDelete(cat)} style={{
              fontSize: "11px", fontWeight: 800,
              color: "#d4537e",
              background: "#fff0f6",
              border: "1.5px solid #f9c0d4",
              borderRadius: "10px",
              padding: "5px 12px",
              cursor: "pointer",
            }}>삭제</button>
          </div>
        ))}

        {showInput ? (
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <input
              type="text"
              placeholder="예: 🎮 게임"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
              style={{
                flex: 1, padding: "12px 16px",
                borderRadius: "16px",
                border: "2px solid #7f77dd",
                fontSize: "13px", outline: "none",
                background: "white",
              }}
            />
            <button onClick={handleAdd} style={{
              padding: "12px 16px", borderRadius: "16px",
              background: "linear-gradient(135deg, #7f77dd, #a78bfa)",
              color: "white", fontSize: "13px", fontWeight: 800,
              border: "none", cursor: "pointer",
            }}>추가</button>
            <button onClick={() => { setShowInput(false); setNewCategory(""); }} style={{
              padding: "12px 16px", borderRadius: "16px",
              background: "white", color: "#aaa",
              fontSize: "13px", fontWeight: 800,
              border: "2px solid #ede9fe", cursor: "pointer",
            }}>취소</button>
          </div>
        ) : (
          <button onClick={() => setShowInput(true)} style={{
            width: "100%", padding: "14px",
            borderRadius: "16px",
            border: "2px dashed #c9c2f5",
            background: "rgba(255,255,255,0.6)",
            color: "#b0a8e8", fontSize: "13px", fontWeight: 800,
            cursor: "pointer", marginTop: "4px",
          }}>+ 카테고리 추가</button>
        )}
      </div>
    </div>
  );
};

export default CategoriesPage;