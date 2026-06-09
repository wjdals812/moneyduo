import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import BottomNav from "../components/BottomNav";

const ANIMAL_EMOJIS = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵"];

const ProfilePage = () => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emoji, setEmoji] = useState("🐰");
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmoji, setPartnerEmoji] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setEmail(user.email || "");
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setDisplayName(data.displayName || user.displayName || "");
          setEmoji(data.emoji || "🐰");

          // 파트너 정보
          const coupleId = data.coupleId;
          if (coupleId) {
            const coupleSnap = await getDoc(doc(db, "couples", coupleId));
            if (coupleSnap.exists()) {
              const members: string[] = coupleSnap.data().members ?? [];
              const partnerUid = members.find((m) => m !== user.uid);
              if (partnerUid) {
                const partnerSnap = await getDoc(doc(db, "users", partnerUid));
                if (partnerSnap.exists()) {
                  const p = partnerSnap.data();
                  setPartnerName(p.displayName || "");
                  setPartnerEmoji(p.emoji || "🐻");
                }
              }
            }
          }
        }
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSaveName = async () => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { displayName: tempName });
    setDisplayName(tempName);
    setEditingName(false);
  };

  const handleSelectEmoji = async (e: string) => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { emoji: e });
    setEmoji(e);
    setShowEmojiPicker(false);
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  return (
    <div style={{
      minHeight: "100svh",
      background: "#f5f3ff",
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "120px",
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* 헤더 */}
      <div style={{
        background: "#ffffff",
        padding: "28px 20px 36px",
        borderRadius: "0 0 32px 32px",
        boxShadow: "0 12px 36px rgba(0,0,0,0.08)",
        borderBottom: "2px dashed rgba(196,196,196,0.28)",
        animation: "fadeUp 0.5s ease both",
      }}>
        <div style={{ fontSize: "18px", fontWeight: 800, color: "#5d4732" }}>내 정보</div>
        <div style={{ fontSize: "12px", color: "#9e8a6f", marginTop: 2 }}>프로필 및 설정</div>
      </div>

      <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* 프로필 카드 */}
        <div style={{
          background: "rgba(255,255,255,0.85)",
          borderRadius: "24px",
          border: "1.5px solid rgba(184,174,222,0.35)",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          animation: "fadeUp 0.5s 0.1s ease both",
          opacity: 0,
          animationFillMode: "forwards",
        }}>
          {/* 이모티콘 */}
          <div
            onClick={() => setShowEmojiPicker(true)}
            style={{
              width: "80px", height: "80px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ede9fe, #f5f0ff)",
              border: "2.5px solid rgba(184,174,222,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "44px", cursor: "pointer",
              boxShadow: "0 4px 16px rgba(127,119,221,0.15)",
            }}
          >
            {emoji}
          </div>
          <div style={{ fontSize: "11px", color: "#b0a8e8" }}>탭해서 변경</div>

          {/* 이름 */}
          <div style={{ width: "100%", textAlign: "center" }}>
            {editingName ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  autoFocus
                  style={{
                    flex: 1, padding: "8px 12px",
                    borderRadius: "12px",
                    border: "2px solid #7f77dd",
                    fontSize: "14px", outline: "none",
                  }}
                />
                <button onClick={handleSaveName} style={{
                  padding: "8px 14px", borderRadius: "12px",
                  background: "linear-gradient(135deg, #7f77dd, #a78bfa)",
                  color: "white", border: "none", cursor: "pointer", fontWeight: 800,
                }}>저장</button>
                <button onClick={() => setEditingName(false)} style={{
                  padding: "8px 14px", borderRadius: "12px",
                  background: "#f0eeff", color: "#9e99cc",
                  border: "none", cursor: "pointer", fontWeight: 800,
                }}>취소</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: "18px", fontWeight: 800, color: "#3C3489" }}>{displayName}</span>
                <button
                  onClick={() => { setTempName(displayName); setEditingName(true); }}
                  style={{
                    fontSize: "11px", color: "#b0a8e8",
                    background: "#f0eeff", border: "none",
                    borderRadius: "8px", padding: "4px 8px", cursor: "pointer",
                  }}
                >수정</button>
              </div>
            )}
          </div>

          {/* 이메일 */}
          <div style={{ fontSize: "12px", color: "#b0a8e8" }}>{email}</div>
        </div>

        {/* 커플 정보 카드 */}
        <div style={{
          background: "rgba(255,255,255,0.85)",
          borderRadius: "24px",
          border: "1.5px solid rgba(184,174,222,0.35)",
          padding: "20px",
          animation: "fadeUp 0.5s 0.2s ease both",
          opacity: 0,
          animationFillMode: "forwards",
        }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#9e99cc", marginBottom: 12 }}>💑 커플</div>
          {partnerName ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "50%",
                background: "linear-gradient(135deg, #ede9fe, #f5f0ff)",
                border: "2px solid rgba(184,174,222,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "24px",
              }}>{partnerEmoji || "🐻"}</div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#3C3489" }}>{partnerName}</div>
                <div style={{ fontSize: "11px", color: "#b0a8e8" }}>연결됨 💜</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "13px", color: "#c4bfea", textAlign: "center", padding: "8px 0" }}>
              아직 연결된 파트너가 없어요
            </div>
          )}
        </div>

        {/* 카테고리 관리 */}
        <button
          onClick={() => navigate("/categories")}
          style={{
            width: "100%", padding: "14px",
            borderRadius: "16px",
            background: "rgba(255,255,255,0.85)",
            border: "1.5px solid rgba(184,174,222,0.35)",
            color: "#3C3489", fontSize: "13px", fontWeight: 800,
            cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            animation: "fadeUp 0.5s 0.3s ease both",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          <span>🏷️ 카테고리 관리</span>
          <span style={{ color: "#b0a8e8" }}>›</span>
        </button>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          style={{
            width: "100%", padding: "14px",
            borderRadius: "16px",
            background: "#fff0f6",
            border: "1.5px solid #f9c0d4",
            color: "#d4537e", fontSize: "13px", fontWeight: 800,
            cursor: "pointer",
            animation: "fadeUp 0.5s 0.3s ease both",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          로그아웃
        </button>
      </div>

      {/* 이모티콘 피커 모달 */}
      {showEmojiPicker && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
          <div onClick={() => setShowEmojiPicker(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
          <div style={{
            background: "white", width: "92%", maxWidth: "360px",
            borderRadius: "24px", padding: "24px", zIndex: 41,
          }}>
            <div style={{ fontWeight: 800, fontSize: "14px", color: "#3C3489", marginBottom: 16 }}>프로필 이모티콘 선택</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
              {ANIMAL_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => handleSelectEmoji(e)}
                  style={{
                    fontSize: "28px", background: emoji === e ? "#ede9fe" : "#f8f7ff",
                    border: emoji === e ? "2px solid #7f77dd" : "2px solid transparent",
                    borderRadius: "14px", padding: "0", width: "100%", aspectRatio: "1", cursor: "pointer",
                  }}
                >{e}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default ProfilePage;