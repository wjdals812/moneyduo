export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  coupleId?: string;
}

export interface Transaction {
  id?: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  paidBy: 'me' | 'partner' | 'together';
  paymentMethod?: string;
  createdBy: string;
  coupleId: string;
}

export type FilterType = 'me' | 'partner' | 'together' | 'all';

// paidBy는 작성자 기준으로 저장되므로, 보는 사람이 작성자가 아니면 me/partner를 뒤집어서 보여준다
export const paidByLabel = (tx: Pick<Transaction, 'paidBy' | 'createdBy'>, viewerUid?: string) => {
  if (tx.paidBy === 'together') return '같이';
  const isOwner = tx.createdBy === viewerUid;
  const effective = isOwner ? tx.paidBy : (tx.paidBy === 'me' ? 'partner' : 'me');
  return effective === 'me' ? '나' : '짝꿍';
};