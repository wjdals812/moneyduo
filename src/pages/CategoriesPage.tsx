import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { theme } from "../theme";

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
      background: theme.bg,
      maxWidth: "400px",
      margin: "0 auto",
    }}>

      <div style={{
        background: theme.surface,
        padding: "20px",
        borderBottom: `1px solid ${theme.border}`,
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: theme.surfaceMuted,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radiusSm,
          color: theme.textMuted,
          fontSize: "16px",
          width: "32px", height: "32px",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text }}>카테고리 관리</div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {categories.map((cat) => (
          <div key={cat} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: theme.surface,
            borderRadius: theme.radiusMd,
            border: `1px solid ${theme.border}`,
            padding: "12px 14px",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: theme.text }}>{cat}</span>
            <button onClick={() => handleDelete(cat)} style={{
              fontSize: "11px", fontWeight: 600,
              color: theme.danger,
              background: theme.dangerBg,
              border: `1px solid rgba(220, 38, 38, 0.25)`,
              borderRadius: theme.radiusSm,
              padding: "5px 10px",
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
                flex: 1, padding: "10px 12px",
                borderRadius: theme.radiusSm,
                border: `1px solid ${theme.accent}`,
                fontSize: "13px", outline: "none",
                background: theme.surface,
              }}
            />
            <button onClick={handleAdd} style={{
              padding: "10px 14px", borderRadius: theme.radiusSm,
              background: theme.accent,
              color: "white", fontSize: "13px", fontWeight: 600,
              border: "none", cursor: "pointer",
            }}>추가</button>
            <button onClick={() => { setShowInput(false); setNewCategory(""); }} style={{
              padding: "10px 14px", borderRadius: theme.radiusSm,
              background: theme.surface, color: theme.textMuted,
              fontSize: "13px", fontWeight: 600,
              border: `1px solid ${theme.border}`, cursor: "pointer",
            }}>취소</button>
          </div>
        ) : (
          <button onClick={() => setShowInput(true)} style={{
            width: "100%", padding: "12px",
            borderRadius: theme.radiusMd,
            border: `1px dashed ${theme.borderStrong}`,
            background: theme.surface,
            color: theme.textMuted, fontSize: "13px", fontWeight: 600,
            cursor: "pointer", marginTop: "4px",
          }}>+ 카테고리 추가</button>
        )}
      </div>
    </div>
  );
};

export default CategoriesPage;
