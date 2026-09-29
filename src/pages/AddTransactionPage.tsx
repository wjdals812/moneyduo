import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import coupleService from "../services/coupleService";
import { theme } from "../theme";

const AddTransactionPage = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("🍜 식비");
  const [paidBy, setPaidBy] = useState<"me" | "partner" | "together">("me");
  const [paymentMethod, setPaymentMethod] = useState("카드");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const defaultCategories = ["🍜 식비", "☕ 카페", "🎬 문화", "🚌 교통", "🛍️ 쇼핑", "💊 의료", "🏠 생활", "💑 데이트", "기타"];
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["현금", "카드"]);
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
      if (snapshot.exists() && snapshot.data().paymentMethods) {
        setPaymentMethods(snapshot.data().paymentMethods);
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
        paymentMethod,
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
      background: theme.bg,
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "40px",
    }}>

      <div style={{
        background: theme.surface,
        padding: "20px",
        borderBottom: `1px solid ${theme.border}`,
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <button onClick={() => navigate("/home")} style={{
          background: theme.surfaceMuted,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radiusSm,
          color: theme.textMuted,
          fontSize: "16px",
          width: "32px", height: "32px",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text }}>내역 추가</div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* 지출/수입 */}
        <div style={{ display: "flex", gap: "8px" }}>
          {(["expense", "income"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: "10px",
              borderRadius: theme.radiusSm, fontSize: "13px", fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${type === t ? theme.accent : theme.border}`,
              background: type === t ? theme.accentMuted : theme.surface,
              color: type === t ? theme.accent : theme.textMuted,
            }}>{t === "expense" ? "지출" : "수입"}</button>
          ))}
        </div>

        {/* 금액 */}
        <div>
          <div style={{ fontSize: "11px", color: theme.textMuted, fontWeight: 600, marginBottom: "6px" }}>금액</div>
          <input type="number" placeholder="0" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", boxSizing: "border-box",
              borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`,
              fontSize: "18px", fontWeight: 700, color: theme.text,
              outline: "none", background: theme.surface, fontVariantNumeric: "tabular-nums",
            }} />
        </div>

        {/* 내용 */}
        <div>
          <div style={{ fontSize: "11px", color: theme.textMuted, fontWeight: 600, marginBottom: "6px" }}>내용</div>
          <input type="text" placeholder="어디서 썼나요?" value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", boxSizing: "border-box",
              borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`,
              fontSize: "13px", outline: "none", background: theme.surface,
            }} />
        </div>

        {/* 카테고리 */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", color: theme.textMuted, fontWeight: 600 }}>카테고리</div>
            <button onClick={() => navigate("/categories")} style={{
              fontSize: "11px", fontWeight: 600, color: theme.accent,
              background: theme.accentMuted, border: `1px solid ${theme.border}`,
              borderRadius: theme.radiusSm, padding: "4px 10px", cursor: "pointer",
            }}>관리</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: "8px 12px", borderRadius: theme.radiusSm,
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
                border: `1px solid ${category === cat ? theme.accent : theme.border}`,
                background: category === cat ? theme.accentMuted : theme.surface,
                color: category === cat ? theme.accent : theme.textMuted,
              }}>{cat}</button>
            ))}
          </div>
        </div>

        {/* 누가 */}
        <div>
          <div style={{ fontSize: "11px", color: theme.textMuted, fontWeight: 600, marginBottom: "6px" }}>누가 썼나요?</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["me", "together", "partner"] as const).map((p) => (
              <button key={p} onClick={() => setPaidBy(p)} style={{
                flex: 1, padding: "10px",
                borderRadius: theme.radiusSm, fontSize: "13px", fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${paidBy === p ? theme.accent : theme.border}`,
                background: paidBy === p ? theme.accentMuted : theme.surface,
                color: paidBy === p ? theme.accent : theme.textMuted,
              }}>{p === "me" ? "나" : p === "together" ? "같이" : "짝꿍"}</button>
            ))}
          </div>
        </div>

        {/* 결제수단 */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", color: theme.textMuted, fontWeight: 600 }}>결제수단</div>
            <button onClick={() => navigate("/paymentmethods")} style={{
              fontSize: "11px", fontWeight: 600, color: theme.accent,
              background: theme.accentMuted, border: `1px solid ${theme.border}`,
              borderRadius: theme.radiusSm, padding: "4px 10px", cursor: "pointer",
            }}>관리</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {paymentMethods.map((m) => (
              <button key={m} onClick={() => setPaymentMethod(m)} style={{
                padding: "8px 12px", borderRadius: theme.radiusSm,
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
                border: `1px solid ${paymentMethod === m ? theme.accent : theme.border}`,
                background: paymentMethod === m ? theme.accentMuted : theme.surface,
                color: paymentMethod === m ? theme.accent : theme.textMuted,
              }}>{m}</button>
            ))}
          </div>
        </div>

        {/* 날짜 */}
        <div>
          <div style={{ fontSize: "11px", color: theme.textMuted, fontWeight: 600, marginBottom: "6px" }}>날짜</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", boxSizing: "border-box",
              borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`,
              fontSize: "13px", outline: "none", background: theme.surface,
            }} />
        </div>

        <button onClick={handleSubmit} style={{
          width: "100%", padding: "14px",
          borderRadius: theme.radiusMd,
          background: theme.accent,
          color: "white", fontSize: "14px", fontWeight: 700,
          border: "none", cursor: "pointer",
          marginTop: "4px",
        }}>저장하기</button>
      </div>
    </div>
  );
};

export default AddTransactionPage;
