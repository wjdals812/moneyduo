import { signInWithPopup } from "firebase/auth";
import { auth, provider, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const LoginPage = () => {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // 유저 문서가 없으면 생성
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName || "",
          email: user.email || "",
          createdAt: serverTimestamp(),
        });
      }

      navigate("/home");
    } catch (error) {
      console.error("로그인 실패:", error);
    }
  };

  return (
    <div style={{
      minHeight: "100svh",
      background: "linear-gradient(180deg, #fbf3e7 0%, #f7efe3 10%, #fdf9f4 100%)",
      backgroundImage: "repeating-linear-gradient(180deg, transparent, transparent 28px, rgba(190, 155, 110, 0.05) 29px, transparent 30px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
      maxWidth: "400px",
      margin: "0 auto",
    }}>

      {/* 배경 장식 원들 */}
      <div style={{
        position: "absolute", top: "-80px", right: "-60px",
        width: "280px", height: "280px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(190, 155, 110, 0.18), transparent)",
        filter: "blur(50px)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "80px", left: "-80px",
        width: "260px", height: "260px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(210, 170, 120, 0.14), transparent)",
        filter: "blur(50px)",
        pointerEvents: "none",
      }} />

      {/* 별/하트 장식들 */}
      {[
        { top: "12%", left: "10%", size: 14, emoji: "✨" },
        { top: "18%", right: "12%", size: 16, emoji: "💫" },
        { top: "70%", right: "8%", size: 13, emoji: "⭐" },
        { top: "75%", left: "12%", size: 15, emoji: "✨" },
        { top: "40%", left: "5%", size: 12, emoji: "🌸" },
        { top: "35%", right: "5%", size: 12, emoji: "🌸" },
      ].map((item, i) => (
        <div key={i} style={{
          position: "absolute",
          top: item.top,
          left: (item as any).left,
          right: (item as any).right,
          fontSize: item.size,
          opacity: 0.6,
          animation: `float${i % 3} ${3 + i * 0.4}s ease-in-out infinite`,
          pointerEvents: "none",
        }}>
          {item.emoji}
        </div>
      ))}

      <style>{`

        @keyframes float0 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(5deg); }
        }
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(-5deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(3deg); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          30% { transform: scale(1.18); }
          60% { transform: scale(1.08); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes btnPop {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 20px #7f77dd40; }
          50% { transform: scale(1.015); box-shadow: 0 8px 28px #7f77dd60; }
        }
        .login-btn:hover {
          transform: scale(1.04) !important;
          box-shadow: 0 8px 32px rgba(184, 149, 106, 0.3) !important;
        }
        .login-btn:active {
          transform: scale(0.97) !important;
        }
      `}</style>

      {/* 메인 카드 */}
      <div style={{
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(12px)",
        borderRadius: "32px",
        border: "1.5px solid rgba(190, 155, 110, 0.25)",
        padding: "44px 36px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: "320px",
        boxShadow: "0 12px 40px rgba(120, 85, 48, 0.1), 0 2px 8px rgba(190, 155, 110, 0.08)",
        animation: "fadeUp 0.6s ease both",
        position: "relative",
        zIndex: 1,
      }}>

        {/* 커플 일러스트 영역 */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "4px",
          animation: "fadeUp 0.6s 0.1s ease both",
          opacity: 0,
          animationFillMode: "forwards",
        }}>
          <div style={{ fontSize: 42 }}>🐰</div>
          <div style={{
            fontSize: 22,
            animation: "heartbeat 1.6s ease-in-out infinite",
            display: "inline-block",
          }}>💜</div>
          <div style={{ fontSize: 42 }}>🐻</div>
        </div>

        {/* 타이틀 */}
        <h1 style={{
          fontSize: "32px",
          fontWeight: 700,
          color: "#6B5F3F",
          margin: "10px 0 4px",
          letterSpacing: "-0.5px",
          animation: "fadeUp 0.6s 0.2s ease both",
          opacity: 0,
          animationFillMode: "forwards",
        }}>
          MoneyDuo
        </h1>

        {/* 서브타이틀 */}
        <p style={{
          fontSize: "13px",
          color: "#9e8a6f",
          marginBottom: "32px",
          textAlign: "center",
          lineHeight: 1.6,
          animation: "fadeUp 0.6s 0.3s ease both",
          opacity: 0,
          animationFillMode: "forwards",
        }}>
          우리 둘이 함께하는<br />
          <span style={{ color: "#8b7355", fontWeight: 700 }}>가계부 💕</span>
        </p>

        {/* 구분선 장식 */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          marginBottom: "24px",
          animation: "fadeUp 0.6s 0.35s ease both",
          opacity: 0,
          animationFillMode: "forwards",
        }}>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, rgba(190, 155, 110, 0.3))" }} />
          <span style={{ fontSize: 14 }}>🌷</span>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, transparent, rgba(190, 155, 110, 0.3))" }} />
        </div>

        {/* 구글 로그인 버튼 */}
        <button
          className="login-btn"
          onClick={handleGoogleLogin}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #7f77dd, #a78bfa)",
            border: "none",
            borderRadius: "18px",
            padding: "15px 24px",
            color: "white",
            fontSize: "14px",
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            animation: "fadeUp 0.6s 0.4s ease both, btnPop 3s 1s ease-in-out infinite",
            opacity: 0,
            animationFillMode: "forwards",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
            letterSpacing: "0.2px",
          }}
        >
          {/* 구글 SVG 아이콘 */}
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#fff" fillOpacity="0.9" d="M44.5 20H24v8.5h11.7C34.2 33.6 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.2 3l6.1-6.1C34.8 5.1 29.7 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.9 0 20.3-7.9 20.3-21 0-1.3-.1-2.7-.3-4z"/>
          </svg>
          Google로 시작하기
        </button>

        {/* 하단 문구 */}
        <p style={{
          fontSize: "11px",
          color: "#b3927d",
          marginTop: "18px",
          animation: "fadeUp 0.6s 0.5s ease both",
          opacity: 0,
          animationFillMode: "forwards",
        }}>
          둘이 함께 로그인해보세요 🐾
        </p>
      </div>
    </div>
  );
};

export default LoginPage;