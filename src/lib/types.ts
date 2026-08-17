export type Role = 'admin' | 'storekeeper' | 'cashier';
/** Credit means the goods moved but the money has not — somebody owes it. */
export type PayMethod = 'cash' | 'transfer' | 'credit';
export type StockLocation = 'store' | 'shop';
export type PaymentStatus = 'paid' | 'partial' | 'pending';
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

/**
 * How a product is stocked, priced and packed. The four configured types cover
 * the whole catalogue; 'unset' marks a product whose packaging is still being
 * decided and which therefore accepts any unit.
 */
export type ProductType = 'weight' | 'piece' | 'carton' | 'carton-piece' | 'unset';
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
  productType: ProductType;
  /** The unit stock is counted in and prices are quoted in. */
  unit: Unit;
  /** Weight-based only: kilograms in one sack/piece, e.g. 50. */
  kgPerPiece: number | null;
  /** Carton types only: retail pieces inside one carton, e.g. 4. */
  piecesPerCarton: number | null;
  costPrice: number;
  sellPrice: number;
  /** Warehouse stock. */
  qtyStore: number;
  /** Counter stock. */
  qtyShop: number;
  /** Store + shop, computed by the database. Never written directly. */
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
  /** Which bank cleared the money — null for cash and credit. */
  bank: Bank | null;
  /** Who owes the balance. Required once anything is left unpaid. */
  customerId: number | null;
  /** Which stock the goods left from. */
  location: StockLocation;
  paymentStatus: PaymentStatus;
  /** Bank transaction / reference number, for anything not paid in cash. */
  txnRef: string | null;
  /** Photographed transfer slip, stored as a compressed data URL. */
  txnPhoto: string | null;
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
  /** Which bank the money left from — null for cash and credit. */
  bank: Bank | null;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  /** Which stock the delivery landed in. */
  location: StockLocation;
  createdAt: number;
  receivedAt: number | null;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  note: string;
  createdAt: number;
}

/** One instalment against a sale or a purchase. */
export interface Payment {
  id: number;
  party: 'sale' | 'purchase';
  saleId: number | null;
  purchaseId: number | null;
  method: PayMethod;
  bank: Bank | null;
  amount: number;
  txnRef: string | null;
  note: string;
  paidAt: number;
  takenByUserId: number | null;
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

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'transport'
  | 'utilities'
  | 'supplies'
  | 'maintenance'
  | 'tax'
  | 'other';

export interface Expense {
  id: number;
  ref: string;
  date: number;
  category: ExpenseCategory;
  description: string;
  amount: number;
  payMethod: PayMethod;
  /** Which bank the money left from — null for cash. */
  bank: Bank | null;
  txnRef: string | null;
  byUserId: number;
  createdAt: number;
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
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  payments: Payment[];
  expenses: Expense[];
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
