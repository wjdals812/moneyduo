import { db } from "../firebase";
import {
  addDoc,
  collection,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  setDoc,
} from "firebase/firestore";

const COUPLES_COL = "couples";
const USERS_COL = "users";

function generateCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function ensureUniqueCode() {
  for (let i = 0; i < 6; i++) {
    const code = generateCode();
    const q = query(collection(db, COUPLES_COL), where("inviteCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return code;
  }
  // fallback
  return generateCode(8);
}

export async function createCouple(currentUid: string) {
  const inviteCode = await ensureUniqueCode();
  const docRef = await addDoc(collection(db, COUPLES_COL), {
    members: [currentUid],
    inviteCode,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, USERS_COL, currentUid), { coupleId: docRef.id }, { merge: true });
  return { coupleId: docRef.id, inviteCode };
}

export async function joinByCode(currentUid: string, code: string) {
  const q = query(collection(db, COUPLES_COL), where("inviteCode", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("유효하지 않은 코드입니다.");

  // 내가 만든 기존 커플 먼저 정리
  await leaveCouple(currentUid);

  const coupleRef = snap.docs[0].ref;
  await runTransaction(db, async (tx) => {
    const coupleSnap = await tx.get(coupleRef);
    if (!coupleSnap.exists()) {
      throw new Error("커플 정보를 찾을 수 없습니다.");
    }
    const members = coupleSnap.data()?.members ?? [];
    if (members.includes(currentUid)) return;
    tx.update(coupleRef, { members: arrayUnion(currentUid) });
    tx.set(doc(db, USERS_COL, currentUid), { coupleId: coupleRef.id }, { merge: true });
  });

  return { coupleId: coupleRef.id };
}

export async function leaveCouple(currentUid: string) {
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

  if (members.length === 1) {
    await deleteDoc(coupleRef);
  } else {
    await updateDoc(coupleRef, { members: arrayRemove(currentUid) });
  }
  await setDoc(userRef, { coupleId: null }, { merge: true });  // 마지막도
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

export async function getMyCouple(currentUid: string) {
  const userRef = doc(db, USERS_COL, currentUid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return null;
  const coupleId = (userSnap.data() as any)?.coupleId;
  if (!coupleId) return null;
  return getCoupleById(coupleId);
}

export default {
  createCouple,
  joinByCode,
  leaveCouple,
  listenToCouple,
  getCoupleById,
  getMyCouple,
};
