import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import coupleService from "../services/coupleService";

const AddTransactionPage = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("🍜 식비");
  const [paidBy, setPaidBy] = useState<"me" | "partner" | "together">("me");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const defaultCategories = ["🍜 식비", "☕ 카페", "🎬 문화", "🚌 교통", "🛍️ 쇼핑", "💊 의료", "🏠 생활", "💑 데이트", "기타"];
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [coupleId, setCoupleId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      // 카테고리 불러오기
      const ref = doc(db, "userSettings", uid);
      const snapshot = await getDoc(ref);
      if (snapshot.exists() && snapshot.data().categories) {
        setCategories(snapshot.data().categories);
      }

      // coupleId 불러오기
      const myCouple = await coupleService.getMyCouple(uid);
      if (myCouple) setCoupleId(myCouple.id);
    };
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!amount || !description) {
      alert("금액과 내용을 입력해주세요!");
      return;
    }
    try {
      await addDoc(collection(db, "transactions"), {
        amount: Number(amount),
        description,
        category,
        paidBy,
        type,
        date,
        createdBy: auth.currentUser?.uid,
        coupleId: coupleId ?? null, // ✅ coupleId 저장
        createdAt: new Date(),
      });
      navigate("/home");
    } catch (error) {
      console.error("저장 실패:", error);
    }
  };

  return (
    <div style={{
      minHeight: "100svh",
      background: "#f5f3ff",
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "40px",
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
        <button onClick={() => navigate("/home")} style={{
          background: "#f2f0fa",
          border: "1.5px solid rgba(155, 142, 196, 0.3)",
          borderRadius: "12px",
          color: "#7A6FA8",
          fontSize: "16px",
          width: "36px", height: "36px",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div style={{ fontSize: "18px", fontWeight: 800, color: "#5a4e7a" }}>내역 추가 💜</div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* 지출/수입 */}
        <div style={{ display: "flex", gap: "8px" }}>
          {(["expense", "income"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: "10px",
              borderRadius: "14px", fontSize: "13px", fontWeight: 800,
              cursor: "pointer", border: "2px solid",
              borderColor: type === t ? "#7f77dd" : "#c9c2f5",
              background: type === t ? "#eeedfe" : "white",
              color: type === t ? "#534AB7" : "#afa9ec",
              transition: "all 0.15s",
            }}>{t === "expense" ? "지출" : "수입"}</button>
          ))}
        </div>

        {/* 금액 */}
        <div>
          <div style={{ fontSize: "11px", color: "#8882cc", fontWeight: 800, marginBottom: "6px" }}>금액</div>
          <input type="number" placeholder="0" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              width: "100%", padding: "12px 16px", boxSizing: "border-box",
              borderRadius: "16px", border: "2px solid #c9c2f5",
              fontSize: "20px", fontWeight: 900, color: "#534AB7",
              outline: "none", background: "white",
            }} />
        </div>

        {/* 내용 */}
        <div>
          <div style={{ fontSize: "11px", color: "#8882cc", fontWeight: 800, marginBottom: "6px" }}>내용</div>
          <input type="text" placeholder="어디서 썼나요?" value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%", padding: "12px 16px", boxSizing: "border-box",
              borderRadius: "16px", border: "2px solid #c9c2f5",
              fontSize: "13px", outline: "none", background: "white",
            }} />
        </div>

        {/* 카테고리 */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", color: "#8882cc", fontWeight: 800 }}>카테고리</div>
            <button onClick={() => navigate("/categories")} style={{
              fontSize: "11px", fontWeight: 800, color: "#7f77dd",
              background: "#eeedfe", border: "1.5px solid #c9c2f5",
              borderRadius: "10px", padding: "4px 10px", cursor: "pointer",
            }}>관리 ⚙️</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: "8px 12px", borderRadius: "12px",
                fontSize: "12px", fontWeight: 800, cursor: "pointer",
                border: "2px solid",
                borderColor: category === cat ? "#7f77dd" : "#c9c2f5",
                background: category === cat ? "#eeedfe" : "white",
                color: category === cat ? "#534AB7" : "#888",
                transition: "all 0.15s",
              }}>{cat}</button>
            ))}
          </div>
        </div>

        {/* 누가 */}
        <div>
          <div style={{ fontSize: "11px", color: "#8882cc", fontWeight: 800, marginBottom: "6px" }}>누가 썼나요?</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["me", "together", "partner"] as const).map((p) => (
              <button key={p} onClick={() => setPaidBy(p)} style={{
                flex: 1, padding: "10px",
                borderRadius: "14px", fontSize: "13px", fontWeight: 800,
                cursor: "pointer", border: "2px solid",
                borderColor: paidBy === p ? "#7f77dd" : "#c9c2f5",
                background: paidBy === p ? "#eeedfe" : "white",
                color: paidBy === p ? "#534AB7" : "#afa9ec",
                transition: "all 0.15s",
              }}>{p === "me" ? "나" : p === "together" ? "같이" : "짝꿍"}</button>
            ))}
          </div>
        </div>

        {/* 날짜 */}
        <div>
          <div style={{ fontSize: "11px", color: "#8882cc", fontWeight: 800, marginBottom: "6px" }}>날짜</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{
              width: "100%", padding: "12px 16px", boxSizing: "border-box",
              borderRadius: "16px", border: "2px solid #c9c2f5",
              fontSize: "13px", outline: "none", background: "white",
            }} />
        </div>

        <button onClick={handleSubmit} style={{
          width: "100%", padding: "16px",
          borderRadius: "20px",
          background: "linear-gradient(135deg, #7f77dd, #a78bfa)",
          color: "white", fontSize: "15px", fontWeight: 900,
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px #7f77dd60",
          marginTop: "4px",
        }}>저장하기 💜</button>
      </div>
    </div>
  );
};

export default AddTransactionPage;