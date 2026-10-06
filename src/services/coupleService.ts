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
const coupleIdCache = new Map<string, string | null>(); // null = 커플 없음이 확정된 상태 (해제 직후 재조회 방지)

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
  // 이전에 만든 커플이 남아 있을 때만 정리 (users.coupleId는 null일 때만 새 값으로 바뀔 수 있음)
  const mySnap = await getDoc(doc(db, USERS_COL, currentUid));
  if ((mySnap.data() as any)?.coupleId) await leaveCouple(currentUid);
  const docRef = doc(collection(db, COUPLES_COL)); // ID만 먼저 확보
  // inviteCodes/{코드} 문서로 코드→coupleId를 조회한다 (couples 쿼리는 규칙상 멤버만 가능).
  // 초대코드·커플·내 문서를 한 번에 커밋(왕복 1회). 규칙이 기존 코드 덮어쓰기를 막으므로 겹치면 전체 실패 → 새 코드로 재시도
  for (let i = 0; i < 6; i++) {
    const inviteCode = generateCode();
    const batch = writeBatch(db);
    batch.set(doc(db, INVITES_COL, inviteCode), { coupleId: docRef.id });
    batch.set(docRef, { members: [currentUid], inviteCode, createdAt: serverTimestamp() });
    batch.set(doc(db, USERS_COL, currentUid), { coupleId: docRef.id }, { merge: true });
    try {
      await batch.commit();
    } catch { continue; /* 코드 중복 */ }
    coupleIdCache.set(currentUid, docRef.id);
    return { coupleId: docRef.id, inviteCode };
  }
  throw new Error("초대 코드 생성에 실패했어요. 다시 시도해주세요.");
}

export async function joinByCode(currentUid: string, code: string) {
  coupleIdCache.delete(currentUid);
  // 코드 조회와 내 문서 조회는 서로 무관하므로 동시에 (왕복 1회로)
  const [inviteSnap, mySnap] = await at("코드 조회", Promise.all([
    getDoc(doc(db, INVITES_COL, code)),
    getDoc(doc(db, USERS_COL, currentUid)),
  ]));
  if (!inviteSnap.exists()) throw new Error("유효하지 않은 코드입니다.");

  // 내가 만든 기존 커플이 있을 때만 정리 (대부분은 없어서 왕복을 건너뜀)
  if ((mySnap.data() as any)?.coupleId) await at("기존 커플 정리", leaveCouple(currentUid));

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
  coupleIdCache.set(currentUid, coupleRef.id); // 이후 내역 조회가 내 문서를 다시 읽지 않도록

  return { coupleId: coupleRef.id };
}

// known: 호출자가 이미 알고 있는 커플 정보(실시간 리스너 값). 주면 조회 2번을 건너뛰고 바로 쓴다.
export async function leaveCouple(currentUid: string, known?: { coupleId: string; members: string[] }) {
  coupleIdCache.delete(currentUid);
  const userRef = doc(db, USERS_COL, currentUid);
  if (known && known.members.includes(currentUid)) {
    const batch = writeBatch(db);
    const coupleRef = doc(db, COUPLES_COL, known.coupleId);
    if (known.members.length === 1) batch.delete(coupleRef);
    else batch.update(coupleRef, { members: arrayRemove(currentUid) });
    batch.set(userRef, { coupleId: null }, { merge: true });
    await batch.commit();
    coupleIdCache.set(currentUid, null);
    return;
  }
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
