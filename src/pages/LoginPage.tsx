import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "../firebase";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      navigate("/home");
    } catch (error) {
      console.error("로그인 실패:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9ff] flex flex-col items-center justify-center font-nunito">
      <div className="text-5xl mb-2">💜</div>
      <h1 className="text-3xl font-extrabold text-[#534AB7] mt-2 mb-1">MoneyDuo</h1>
      <p className="text-sm text-[#afa9ec] mb-10">커플 가계부, 함께라서 더 즐거워요</p>
      <button
        onClick={handleGoogleLogin}
        className="font-sans bg-white border-2 border-[#c9c2f5] rounded-2xl px-8 py-4 text-sm font-bold text-[#534AB7] cursor-pointer hover:bg-[#eeedfe] transition-colors whitespace-nowrap"
      >
        🔵 Google로 시작하기
      </button>
    </div>
  );
};

export default LoginPage;