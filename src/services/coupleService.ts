import { db } from "../firebase";
import {
  collection,
  doc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDoc,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";

const COUPLES_COL = "couples";
const USERS_COL = "users";
const INVITES_COL = "inviteCodes";

// 내 coupleId 캐시 (화면 이동마다 users 문서를 다시 읽지 않기 위함). 생성/참여/탈퇴 시 무효화.
const coupleIdCache = new Map<string, string>();

// 어느 단계에서 권한 오류가 났는지 알 수 있도록 에러 메시지에 단계 이름을 붙인다
const at = <T,>(label: string, p: Promise<T>) =>
  p.catch((e) => { throw new Error(`[${label}] ${e?.message ?? e}`); });

function generateCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createCouple(currentUid: string) {
  coupleIdCache.delete(currentUid);
  // 이전에 만든 커플이 남아 있으면 정리 (users.coupleId는 null일 때만 새 값으로 바뀔 수 있음)
  await leaveCouple(currentUid);
  const docRef = doc(collection(db, COUPLES_COL)); // ID만 먼저 확보
  // inviteCodes/{코드} 문서로 코드→coupleId를 조회한다 (couples 쿼리는 규칙상 멤버만 가능).
  // 규칙이 기존 문서 덮어쓰기를 막으므로 코드가 겹치면 실패 → 재시도
  let inviteCode = "";
  for (let i = 0; i < 6 && !inviteCode; i++) {
    const code = generateCode();
    try {
      await setDoc(doc(db, INVITES_COL, code), { coupleId: docRef.id });
      inviteCode = code;
    } catch { /* 코드 중복 */ }
  }
  if (!inviteCode) throw new Error("초대 코드 생성에 실패했어요. 다시 시도해주세요.");
  await setDoc(docRef, { members: [currentUid], inviteCode, createdAt: serverTimestamp() });
  await setDoc(doc(db, USERS_COL, currentUid), { coupleId: docRef.id }, { merge: true });
  return { coupleId: docRef.id, inviteCode };
}

export async function joinByCode(currentUid: string, code: string) {
  coupleIdCache.delete(currentUid);
  const inviteSnap = await at("코드 조회", getDoc(doc(db, INVITES_COL, code)));
  if (!inviteSnap.exists()) throw new Error("유효하지 않은 코드입니다.");

  // 내가 만든 기존 커플 먼저 정리
  await at("기존 커플 정리", leaveCouple(currentUid));

  const coupleRef = doc(db, COUPLES_COL, inviteSnap.data().coupleId);
  const coupleSnap = await at("커플 조회", getDoc(coupleRef));
  if (!coupleSnap.exists()) throw new Error("커플 정보를 찾을 수 없습니다.");
  // 멤버 추가 + 내 coupleId 설정을 한 번에 커밋 (왕복 1회, 중간 상태 없음)
  const batch = writeBatch(db);
  if (!(coupleSnap.data()?.members ?? []).includes(currentUid)) {
    batch.update(coupleRef, { members: arrayUnion(currentUid) });
  }
  batch.set(doc(db, USERS_COL, currentUid), { coupleId: coupleRef.id }, { merge: true });
  await at("참여 처리", batch.commit());

  return { coupleId: coupleRef.id };
}

export async function leaveCouple(currentUid: string) {
  coupleIdCache.delete(currentUid);
  const userRef = doc(db, USERS_COL, currentUid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;
  const data = userSnap.data() as any;
  const coupleId = data?.coupleId;
  if (!coupleId) return;

  const coupleRef = doc(db, COUPLES_COL, coupleId);
  const coupleSnap = await getDoc(coupleRef);
  if (!coupleSnap.exists()) {
    // updateDoc → setDoc with merge
    await setDoc(userRef, { coupleId: null }, { merge: true });
    return;
  }

  const members = coupleSnap.data()?.members ?? [];
  if (!Array.isArray(members) || !members.includes(currentUid)) {
    await setDoc(userRef, { coupleId: null }, { merge: true });  // 여기도
    return;
  }

  // 커플 정리 + 내 coupleId 비우기를 한 번에 커밋
  const batch = writeBatch(db);
  if (members.length === 1) batch.delete(coupleRef);
  else batch.update(coupleRef, { members: arrayRemove(currentUid) });
  batch.set(userRef, { coupleId: null }, { merge: true });
  await batch.commit();
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
  let coupleId = coupleIdCache.get(currentUid);
  if (!coupleId) {
    const userSnap = await getDoc(doc(db, USERS_COL, currentUid));
    coupleId = (userSnap.data() as any)?.coupleId;
    if (!coupleId) return null;
    coupleIdCache.set(currentUid, coupleId);
  }
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
