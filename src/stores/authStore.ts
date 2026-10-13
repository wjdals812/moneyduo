import { create } from "zustand";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

// uid: undefined = 인증 복원 대기 중, null = 비로그인, string = 로그인
// 페이지마다 onAuthStateChanged를 따로 붙이지 않도록 앱 전체에서 한 번만 구독한다
export const useAuthStore = create<{ uid: string | null | undefined }>(() => ({ uid: undefined }));

onAuthStateChanged(auth, (user) => useAuthStore.setState({ uid: user?.uid ?? null }));
