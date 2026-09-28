import { signInWithPopup, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth, provider, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useEffect } from "react";
import { theme } from "../theme";

const LoginPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/home");
    });
    return () => unsubscribe();
  }, [navigate]);

  const ensureUserDoc = async (user: { uid: string; displayName: string | null; email: string | null }, defaultName = "") => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || defaultName,
        email: user.email || "",
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      await ensureUserDoc(result.user);
      navigate("/home");
    } catch (error) {
      console.error("로그인 실패:", error);
    }
  };

  // 포트폴리오 시연용 데모 로그인 (Firebase Auth에 익명 로그인 활성화 필요)
  // 방문자마다 독립된 uid를 받도록 익명 로그인 사용 (계정 공유 시 서로 데이터를 덮어쓰는 문제 방지)
  const handleDemoLogin = async () => {
    try {
      const result = await signInAnonymously(auth);
      await ensureUserDoc(result.user, "데모 사용자");
      navigate("/home");
    } catch (error) {
      console.error("데모 로그인 실패:", error);
    }
  };

  return (
    <div style={{
      minHeight: "100svh",
      background: theme.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      maxWidth: "400px",
      margin: "0 auto",
    }}>

      {/* 메인 카드 */}
      <div style={{
        background: theme.surface,
        borderRadius: theme.radiusLg,
        border: `1px solid ${theme.border}`,
        padding: "40px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: "320px",
      }}>

        {/* 타이틀 */}
        <h1 style={{
          fontSize: "26px",
          fontWeight: 700,
          color: theme.text,
          margin: "0 0 4px",
          letterSpacing: "-0.3px",
        }}>
          MoneyDuo
        </h1>

        {/* 서브타이틀 */}
        <p style={{
          fontSize: "13px",
          color: theme.textMuted,
          marginBottom: "28px",
          textAlign: "center",
          lineHeight: 1.6,
        }}>
          둘이 함께 쓰는 가계부
        </p>

        {/* 구분선 */}
        <div style={{ width: "100%", height: "1px", background: theme.border, marginBottom: "24px" }} />

        {/* 구글 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          style={{
            width: "100%",
            background: theme.accent,
            border: "none",
            borderRadius: theme.radiusMd,
            padding: "13px 24px",
            color: "white",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          {/* 구글 SVG 아이콘 */}
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#fff" fillOpacity="0.9" d="M44.5 20H24v8.5h11.7C34.2 33.6 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.2 3l6.1-6.1C34.8 5.1 29.7 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.9 0 20.3-7.9 20.3-21 0-1.3-.1-2.7-.3-4z"/>
          </svg>
          Google로 시작하기
        </button>

        {/* 데모 계정 로그인 버튼 (포트폴리오 시연용) */}
        <button
          onClick={handleDemoLogin}
          style={{
            width: "100%",
            background: "transparent",
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radiusMd,
            padding: "13px 24px",
            color: theme.text,
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            marginTop: "10px",
          }}
        >
          데모 계정으로 체험하기
        </button>

        {/* 하단 문구 */}
        <p style={{
          fontSize: "11px",
          color: theme.textFaint,
          marginTop: "16px",
        }}>
          둘이 함께 로그인해보세요
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
