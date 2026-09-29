import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import { theme } from "../theme";

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
      background: theme.bg,
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "120px",
    }}>
      {/* 헤더 */}
      <div style={{
        background: theme.surface,
        padding: "20px",
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: theme.text }}>내 정보</div>
        <div style={{ fontSize: "12px", fontWeight: 500, color: theme.textMuted, marginTop: 2 }}>프로필 및 설정</div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* 프로필 카드 */}
        <div style={{
          background: theme.surface,
          borderRadius: theme.radiusMd,
          border: `1px solid ${theme.border}`,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}>
          {/* 이모티콘 */}
          <div
            onClick={() => setShowEmojiPicker(true)}
            style={{
              width: "72px", height: "72px",
              borderRadius: "50%",
              background: theme.surfaceMuted,
              border: `1px solid ${theme.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "36px", cursor: "pointer",
            }}
          >
            {emoji}
          </div>
          <div style={{ fontSize: "11px", color: theme.textFaint }}>탭해서 변경</div>

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
                    borderRadius: theme.radiusSm,
                    border: `1px solid ${theme.border}`,
                    fontSize: "14px", outline: "none",
                  }}
                />
                <button onClick={handleSaveName} style={{
                  padding: "8px 14px", borderRadius: theme.radiusSm,
                  background: theme.accent,
                  color: "white", border: "none", cursor: "pointer", fontWeight: 600,
                }}>저장</button>
                <button onClick={() => setEditingName(false)} style={{
                  padding: "8px 14px", borderRadius: theme.radiusSm,
                  background: theme.surfaceMuted, color: theme.textMuted,
                  border: `1px solid ${theme.border}`, cursor: "pointer", fontWeight: 600,
                }}>취소</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: "16px", fontWeight: 700, color: theme.text }}>{displayName}</span>
                <button
                  onClick={() => { setTempName(displayName); setEditingName(true); }}
                  style={{
                    fontSize: "11px", color: theme.textMuted,
                    background: theme.surfaceMuted, border: `1px solid ${theme.border}`,
                    borderRadius: theme.radiusSm, padding: "4px 8px", cursor: "pointer",
                  }}
                >수정</button>
              </div>
            )}
          </div>

          {/* 이메일 */}
          <div style={{ fontSize: "12px", color: theme.textFaint }}>{email}</div>
        </div>

        {/* 커플 정보 카드 */}
        <div style={{
          background: theme.surface,
          borderRadius: theme.radiusMd,
          border: `1px solid ${theme.border}`,
          padding: "20px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: theme.textMuted, marginBottom: 12 }}>커플</div>
          {partnerName ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "50%",
                background: theme.surfaceMuted,
                border: `1px solid ${theme.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px",
              }}>{partnerEmoji || "🐻"}</div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: theme.text }}>{partnerName}</div>
                <div style={{ fontSize: "11px", color: theme.textFaint }}>연결됨</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "13px", color: theme.textFaint, textAlign: "center", padding: "8px 0" }}>
              아직 연결된 파트너가 없어요
            </div>
          )}
        </div>

        {/* 카테고리 관리 */}
        <button
          onClick={() => navigate("/categories")}
          style={{
            width: "100%", padding: "14px",
            borderRadius: theme.radiusMd,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            color: theme.text, fontSize: "13px", fontWeight: 600,
            cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <span>카테고리 관리</span>
          <span style={{ color: theme.textMuted }}>›</span>
        </button>

        {/* 결제수단 관리 */}
        <button
          onClick={() => navigate("/paymentmethods")}
          style={{
            width: "100%", padding: "14px",
            borderRadius: theme.radiusMd,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            color: theme.text, fontSize: "13px", fontWeight: 600,
            cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <span>결제수단 관리</span>
          <span style={{ color: theme.textMuted }}>›</span>
        </button>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          style={{
            width: "100%", padding: "14px",
            borderRadius: theme.radiusMd,
            background: theme.dangerBg,
            border: `1px solid rgba(220, 38, 38, 0.25)`,
            color: theme.danger, fontSize: "13px", fontWeight: 600,
            cursor: "pointer",
          }}
        >
          로그아웃
        </button>
      </div>

      {/* 이모티콘 피커 모달 */}
      {showEmojiPicker && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
          <div onClick={() => setShowEmojiPicker(false)} style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.4)" }} />
          <div style={{
            background: theme.surface, width: "92%", maxWidth: "360px",
            borderRadius: theme.radiusMd, border: `1px solid ${theme.border}`, padding: "20px", zIndex: 41,
          }}>
            <div style={{ fontWeight: 700, fontSize: "14px", color: theme.text, marginBottom: 14 }}>프로필 이모티콘 선택</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
              {ANIMAL_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => handleSelectEmoji(e)}
                  style={{
                    fontSize: "24px", background: emoji === e ? theme.accentMuted : theme.surfaceMuted,
                    border: `1px solid ${emoji === e ? theme.accent : theme.border}`,
                    borderRadius: theme.radiusSm, padding: "0", width: "100%", aspectRatio: "1", cursor: "pointer",
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
