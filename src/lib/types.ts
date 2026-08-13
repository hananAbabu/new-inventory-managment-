export type Role = 'admin' | 'storekeeper' | 'cashier';
export type PayMethod = 'cash' | 'transfer' | 'debit';
export type Bank =
  | 'cbe'
  | 'boa'
  | 'awash'
  | 'dashen'
  | 'coop'
  | 'oromiya'
  | 'shebele'
  | 'check';
export type Unit = 'pcs' | 'kg' | 'l' | 'carton';
export type PurchaseStatus = 'ordered' | 'received';
export type TxType =
  | 'initial'
  | 'purchase'
  | 'sale'
  | 'received'
  | 'damage'
  | 'lost'
  | 'adjustment';

export interface Settings {
  shopName: string;
  currency: string;
  taxRate: number;
  maxDiscount: number;
  address: string;
  phone: string;
  receiptFooter: string;
}

export interface User {
  id: number;
  username: string;
  password: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: number;
}

export interface Category {
  id: number;
  name: string;
  description: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  createdAt: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  categoryId: number;
  supplierId: number | null;
  unit: Unit;
  costPrice: number;
  sellPrice: number;
  qty: number;
  minStock: number;
  createdAt: number;
  updatedAt: number;
}

export interface SaleItem {
  productId: number;
  sku: string;
  name: string;
  unit: Unit;
  price: number;
  cost: number;
  qty: number;
}

export interface Sale {
  id: number;
  ref: string;
  cashierId: number;
  items: SaleItem[];
  subtotal: number;
  discountPct: number;
  discount: number;
  tax: number;
  total: number;
  payMethod: PayMethod;
  /** Which bank cleared the money — null for cash. */
  bank: Bank | null;
  amountPaid: number;
  change: number;
  createdAt: number;
}

export interface PurchaseItem {
  productId: number;
  sku: string;
  name: string;
  unit: Unit;
  qty: number;
  cost: number;
}

export interface Purchase {
  id: number;
  ref: string;
  supplierId: number;
  byUserId: number;
  items: PurchaseItem[];
  total: number;
  status: PurchaseStatus;
  payMethod: PayMethod;
  /** Which bank the money left from — null for cash. */
  bank: Bank | null;
  createdAt: number;
  receivedAt: number | null;
}

export interface Payment {
  id: number;
  saleId: number;
  method: PayMethod;
  bank: Bank | null;
  amount: number;
  createdAt: number;
}

export interface InvTx {
  id: number;
  date: number;
  productId: number;
  sku: string;
  name: string;
  unit: Unit;
  type: TxType;
  qty: number;
  userId: number;
  note: string;
}

export interface AuditEntry {
  id: number;
  date: number;
  userId: number | null;
  group: string;
  action: string;
  detail: string;
}

export interface Db {
  settings: Settings;
  users: User[];
  categories: Category[];
  suppliers: Supplier[];
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  payments: Payment[];
  invTx: InvTx[];
  audit: AuditEntry[];
}

export interface Session {
  userId: number;
}

export interface CartLine {
  productId: number;
  qty: number;
}
