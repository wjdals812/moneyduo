import { auth, db } from "../firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

const COUPLES_COL = "couples";
const USERS_COL = "users";

// 내 coupleId 캐시 (화면 이동마다 users 문서를 다시 읽지 않기 위함). 생성/참여/탈퇴 시 갱신.
const coupleIdCache = new Map<string, string | null>(); // null = 커플 없음이 확정된 상태 (해제 직후 재조회 방지)

// 커플 쓰기는 서버 API가 처리한다 (보안 규칙상 클라이언트는 직접 쓸 수 없음)
async function callApi<T>(path: "create" | "join" | "leave", body?: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("로그인 필요");
  const res = await fetch(`/api/couple/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "요청에 실패했어요. 다시 시도해주세요.");
  return data as T;
}

export async function createCouple(currentUid: string) {
  coupleIdCache.delete(currentUid);
  const res = await callApi<{ coupleId: string; inviteCode: string }>("create");
  coupleIdCache.set(currentUid, res.coupleId);
  return res;
}

export async function joinByCode(currentUid: string, code: string) {
  coupleIdCache.delete(currentUid);
  const res = await callApi<{ coupleId: string }>("join", { code });
  coupleIdCache.set(currentUid, res.coupleId); // 이후 내역 조회가 내 문서를 다시 읽지 않도록
  return res;
}

export async function leaveCouple(currentUid: string) {
  coupleIdCache.delete(currentUid);
  await callApi<void>("leave");
  coupleIdCache.set(currentUid, null);
}

export function listenToCouple(coupleId: string, onChange: (data: any) => void) {
  const ref = doc(db, COUPLES_COL, coupleId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      onChange(null);
      return;
    }
    onChange({ id: snap.id, ...snap.data() });
  });
}

export async function getCoupleById(coupleId: string) {
  const ref = doc(db, COUPLES_COL, coupleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Record<string, any>;
}

export async function getMyCoupleId(currentUid: string) {
  if (coupleIdCache.has(currentUid)) return coupleIdCache.get(currentUid) ?? null;
  const userSnap = await getDoc(doc(db, USERS_COL, currentUid));
  const coupleId: string | null = (userSnap.data() as any)?.coupleId ?? null;
  if (coupleId) coupleIdCache.set(currentUid, coupleId);
  return coupleId;
}

export async function getMyCouple(currentUid: string) {
  const coupleId = await getMyCoupleId(currentUid);
  // 커플 문서는 파트너가 바꿀 수 있으므로 캐시하지 않고 매번 조회
  return coupleId ? getCoupleById(coupleId) : null;
}

export default {
  createCouple,
  joinByCode,
  leaveCouple,
  listenToCouple,
  getCoupleById,
  getMyCouple,
  getMyCoupleId,
};
