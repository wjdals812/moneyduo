import { create } from "zustand";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthStore } from "./authStore";

export interface UserSettings {
  categories?: string[];
  paymentMethods?: string[];
  monthlyBudget?: number | null;
  categoryBudgets?: Record<string, number>;
  [key: string]: unknown; // ListManagePage가 fieldName으로 접근
}

export const useSettingsStore = create<{ settings: UserSettings }>(() => ({ settings: {} }));

// 로그인할 때 userSettings를 한 번만 읽어 모든 페이지가 공유하고, 로그아웃하면 비운다
// ponytail: 다른 기기에서 바꾼 설정은 새로고침 전까지 반영되지 않음 (필요하면 onSnapshot으로 교체)
function syncSettings(uid: string | null | undefined) {
  if (!uid) {
    if (uid === null) useSettingsStore.setState({ settings: {} });
    return;
  }
  getDoc(doc(db, "userSettings", uid))
    .then((snap) => {
      if (useAuthStore.getState().uid !== uid) return; // 읽는 사이 로그아웃/계정 전환된 경우
      useSettingsStore.setState({ settings: snap.exists() ? snap.data() : {} });
    })
    .catch(console.error);
}

useAuthStore.subscribe((state, prev) => {
  if (state.uid !== prev.uid) syncSettings(state.uid);
});
syncSettings(useAuthStore.getState().uid); // 이 모듈이 인증 복원 뒤에 로드된 경우 대비

// 화면에는 즉시 반영하고 Firestore에는 병합 저장
export async function saveSettings(patch: UserSettings) {
  const uid = useAuthStore.getState().uid;
  if (!uid) return;
  useSettingsStore.setState((s) => ({ settings: { ...s.settings, ...patch } }));
  await setDoc(doc(db, "userSettings", uid), patch, { merge: true });
}
