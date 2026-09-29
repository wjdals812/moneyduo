import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { theme } from "../theme";

interface Props {
  title: string;
  fieldName: string;
  defaultItems: string[];
  placeholder: string;
  addLabel: string;
}

const ListManagePage = ({ title, fieldName, defaultItems, placeholder, addLabel }: Props) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<string[]>(defaultItems);
  const [newItem, setNewItem] = useState("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const ref = doc(db, "userSettings", uid);
      const snapshot = await getDoc(ref);
      if (snapshot.exists() && snapshot.data()[fieldName]) {
        setItems(snapshot.data()[fieldName]);
      }
    };
    fetchItems();
  }, [fieldName]);

  const save = async (updated: string[]) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(doc(db, "userSettings", uid), { [fieldName]: updated }, { merge: true });
  };

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    const updated = [...items, newItem];
    setItems(updated);
    await save(updated);
    setNewItem("");
    setShowInput(false);
  };

  const handleDelete = async (item: string) => {
    const updated = items.filter((i) => i !== item);
    setItems(updated);
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
        <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text }}>{title}</div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((item) => (
          <div key={item} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: theme.surface,
            borderRadius: theme.radiusMd,
            border: `1px solid ${theme.border}`,
            padding: "12px 14px",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: theme.text }}>{item}</span>
            <button onClick={() => handleDelete(item)} style={{
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
              placeholder={placeholder}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
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
            <button onClick={() => { setShowInput(false); setNewItem(""); }} style={{
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
          }}>{addLabel}</button>
        )}
      </div>
    </div>
  );
};

export default ListManagePage;
