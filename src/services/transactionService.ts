import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore";
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