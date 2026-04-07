export type PaymentType = 'UPI' | 'Debit' | 'Credit' | 'Net Banking';
export type TransactionType = 'in' | 'out' | 'transfer';

export interface AppUser {
  id: string;
  display_name: string;
  email: string;
  photo_url: string;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  owner_id: string;
  bank_key: string;
  bank_name: string;
  bank_is_custom: boolean;
  payment_type: PaymentType;
  upi_app: string | null;
  upi_app_is_custom: boolean;
  upi_app_name: string | null;
  last_four_digits: string | null;
  created_at: string;
}

export interface Book {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  color_tag: string;
  icon_emoji: string;
  created_at: string;
  is_shared: boolean;
  share_id: string | null;
}

export interface Transaction {
  id: string;
  book_id: string;
  owner_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  payment_method_id: string | null;
  to_payment_method_id: string | null; // transfer: destination account
  person: string;                       // who you sent to / received from
  note: string;
  date: string;
  created_at: string;
}

export interface BookStats {
  cashIn: number;
  cashOut: number;
  balance: number;
}
