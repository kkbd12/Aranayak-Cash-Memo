export interface Product {
  id: string;
  name: string;
  code?: string;
  price: number;
  unit: string; // e.g. 'পিস' (pc), 'কেজি' (kg), 'লিটার' (ltr), 'প্যাকেট' (pkt)
  category?: string;
  stock?: number;
}

export interface MemoItem {
  id: string;
  productId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  total: number;
  isGift?: boolean;
  giftNote?: string;
}

export type PaymentMethod = 'Cash' | 'Bangla QR';

export interface CashMemo {
  id: string;
  memoNo: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: MemoItem[];
  subtotal: number;
  discount: number;
  discountType: 'flat' | 'percent';
  tax: number; // percentage or amount
  shipping: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  status: 'Paid' | 'Partial' | 'Due';
  notes?: string;
  createdAt: string;
}

export interface ShopSettings {
  shopName: string;
  proprietorName: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address: string;
  invoicePrefix: string;
  nextMemoNumber: number;
  footerText: string;
  currencySymbol: string;
  logoUrl?: string;
  receiptFormat: 'A4' | 'A5' | 'POS-80mm';
}

export interface DailySalesSummary {
  date: string;
  totalMemos: number;
  totalSalesAmount: number;
  totalPaidAmount: number;
  totalDueAmount: number;
  cashPaid: number;
  mobileBankingPaid: number;
  cardPaid: number;
}
