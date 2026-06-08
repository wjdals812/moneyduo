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
  createdBy: string;
  coupleId: string;
}

export type FilterType = 'me' | 'partner' | 'together' | 'all';