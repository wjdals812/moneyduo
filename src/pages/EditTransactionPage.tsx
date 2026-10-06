import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import coupleService from "../services/coupleService";
import { theme } from "../theme";

const EditTransactionPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const defaultCategories = ["🍜 식비", "☕ 카페", "🎬 문화", "🚌 교통", "🛍️ 쇼핑", "💊 의료", "🏠 생활", "💑 데이트", "기타"];
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("🍜 식비");
  const [paidBy, setPaidBy] = useState<"me" | "partner" | "together">("me");
  const [paymentMethod, setPaymentMethod] = useState("카드");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["현금", "카드"]);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState("");
  const [coupleId, setCoupleId] = useState<string | null>(null);

  useEffect(() => {
    // 기존 내역이 핵심이므로 설정/커플 조회와 병렬로, 서로 실패에 영향받지 않게 불러온다
    const fetchTransaction = async () => {
      if (!id) return;
      try {
        const txSnap = await getDoc(doc(db, "transactions", id));
        if (!txSnap.exists()) {
          alert("내역을 찾을 수 없어요.");
          return;
        }
        const data = txSnap.data();
        setAmount(String(data.amount));
        setDescription(data.description);
        setCategory(data.category);
        setPaidBy(data.paidBy);
        setPaymentMethod(data.paymentMethod ?? "카드");
        setType(data.type);
        setDate(data.date);
      } catch (error) {
        console.error("내역 불러오기 실패:", error);
        alert(`내역을 불러오지 못했어요. (${(error as { code?: string }).code ?? "알 수 없는 오류"})`);
      }
    };

    const fetchSettings = async (uid: string) => {
      try {
        const snapshot = await getDoc(doc(db, "userSettings", uid));
        if (snapshot.exists() && snapshot.data().categories) setCategories(snapshot.data().categories);
        if (snapshot.exists() && snapshot.data().paymentMethods) setPaymentMethods(snapshot.data().paymentMethods);
      } catch (error) {
        console.error("설정 불러오기 실패:", error);
      }
    };

    const fetchData = (uid: string) => {
      fetchTransaction();
      fetchSettings(uid);
      coupleService.getMyCoupleId(uid).then(setCoupleId).catch((e) => console.error("커플 조회 실패:", e));
    };
    // 새로고침/직접 진입 시 auth.currentUser가 null이므로 인증 복원을 기다린다
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) fetchData(user.uid);
    });
    return () => unsubscribe();
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
        paymentMethod,
        type,
        date,
        coupleId: coupleId ?? null, // ✅ 기존 내역에도 coupleId 업데이트
        updatedAt: new Date(),
      });
      navigate("/home");
    } catch (error) {
      console.error("수정 실패:", error);
      alert(`수정에 실패했어요. (${(error as { code?: string }).code ?? "알 수 없는 오류"})`);
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
        <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text }}>내역 수정</div>
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

        <button onClick={handleUpdate} style={{
            width: "100%", padding: "14px",
            borderRadius: theme.radiusMd,
            background: theme.accent,
            color: "white", fontSize: "14px", fontWeight: 700,
            border: "none", cursor: "pointer",
            marginTop: "4px",
          }}>수정하기
        </button>
      </div>
    </div>
  );
};

export default EditTransactionPage;
