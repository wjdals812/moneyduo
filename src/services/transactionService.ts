import { collection, addDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import coupleService from "./coupleService";
import { db } from "../firebase";
import type { Transaction } from "../types/index";

export const addTransaction = async (transaction: Omit<Transaction, "id">) => {
  const docRef = await addDoc(collection(db, "transactions"), transaction);
  return docRef.id;
};

export const getTransactions = async (coupleId: string) => {
  const q = query(
    collection(db, "transactions"),
    where("coupleId", "==", coupleId),
    orderBy("date", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
};
// 월별 내역 메모리 캐시: 화면을 다시 열 때 캐시를 먼저 보여주고 뒤에서 갱신한다.
const monthCache = new Map<string, Transaction[]>();
export const getCachedMonth = (uid: string, monthKey: string) => monthCache.get(`${uid}:${monthKey}`);

// 선택한 달의 내 내역 + (커플이면) 커플 내역을 서버에서 범위 조회해 중복 제거 후 반환
export const fetchMonthTransactions = async (uid: string, monthKey: string) => {
  const monthRange = [where("date", ">=", `${monthKey}-01`), where("date", "<=", `${monthKey}-31`)];
  const byField = (field: "createdBy" | "coupleId", value: string) =>
    getDocs(query(collection(db, "transactions"), where(field, "==", value), ...monthRange, orderBy("date", "desc"), limit(300)));

  const coupleId = await coupleService.getMyCoupleId(uid);
  const snaps = await Promise.all([byField("createdBy", uid), ...(coupleId ? [byField("coupleId", coupleId)] : [])]);

  const seen = new Set<string>();
  const data: Transaction[] = [];
  for (const d of snaps.flatMap((s) => s.docs)) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    data.push({ id: d.id, ...d.data() } as Transaction);
  }
  data.sort((a, b) => b.date.localeCompare(a.date));
  monthCache.set(`${uid}:${monthKey}`, data);
  return data;
};
