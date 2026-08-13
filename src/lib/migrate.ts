import type {
  AuditEntry,
  Bank,
  Category,
  Db,
  InvTx,
  PayMethod,
  Payment,
  Product,
  Purchase,
  PurchaseItem,
  Role,
  Sale,
  SaleItem,
  Settings,
  Supplier,
  Unit,
  User,
} from './types';

/**
 * Workspaces saved before banks, units and the storekeeper rename are still
 * sitting in people's browsers. This brings them up to the current shape on
 * load, so nobody has to reset their demo data.
 */

type LegacyPayMethod = PayMethod | 'card' | 'mobile';
type LegacyRole = Role | 'shopkeeper';

interface LegacyUser extends Omit<User, 'role'> {
  role: LegacyRole;
}
interface LegacyProduct extends Omit<Product, 'unit'> {
  unit?: Unit;
}
interface LegacySaleItem extends Omit<SaleItem, 'unit'> {
  unit?: Unit;
}
interface LegacySale extends Omit<Sale, 'payMethod' | 'bank' | 'items' | 'txnRef' | 'txnPhoto'> {
  payMethod: LegacyPayMethod;
  bank?: Bank | null;
  txnRef?: string | null;
  txnPhoto?: string | null;
  items: LegacySaleItem[];
}
interface LegacyPurchaseItem extends Omit<PurchaseItem, 'unit'> {
  unit?: Unit;
}
interface LegacyPurchase extends Omit<Purchase, 'payMethod' | 'bank' | 'items'> {
  payMethod?: LegacyPayMethod;
  bank?: Bank | null;
  items: LegacyPurchaseItem[];
}
interface LegacyPayment extends Omit<Payment, 'method' | 'bank'> {
  method: LegacyPayMethod;
  bank?: Bank | null;
}
interface LegacyInvTx extends Omit<InvTx, 'unit'> {
  unit?: Unit;
}

export interface LegacyDb {
  settings: Settings;
  users: LegacyUser[];
  categories: Category[];
  suppliers: Supplier[];
  products: LegacyProduct[];
  sales: LegacySale[];
  purchases: LegacyPurchase[];
  payments: LegacyPayment[];
  invTx: LegacyInvTx[];
  audit: AuditEntry[];
}

function payMethod(m: LegacyPayMethod | undefined): PayMethod {
  if (m === 'card') return 'transfer';
  if (m === 'mobile') return 'debit';
  return m ?? 'cash';
}

function role(r: LegacyRole): Role {
  return r === 'shopkeeper' ? 'storekeeper' : r;
}

export function migrate(db: LegacyDb): Db {
  const unitOf = (productId: number, fallback?: Unit): Unit =>
    fallback ?? db.products.find((p) => p.id === productId)?.unit ?? 'pcs';

  return {
    settings: db.settings,
    categories: db.categories,
    suppliers: db.suppliers,
    audit: db.audit,
    users: db.users.map((u) => ({ ...u, role: role(u.role) })),
    products: db.products.map((p) => ({ ...p, unit: p.unit ?? 'pcs' })),
    sales: db.sales.map((s) => ({
      ...s,
      payMethod: payMethod(s.payMethod),
      bank: s.bank ?? null,
      txnRef: s.txnRef ?? null,
      txnPhoto: s.txnPhoto ?? null,
      items: s.items.map((i) => ({ ...i, unit: unitOf(i.productId, i.unit) })),
    })),
    purchases: db.purchases.map((p) => ({
      ...p,
      payMethod: payMethod(p.payMethod),
      bank: p.bank ?? null,
      items: p.items.map((i) => ({ ...i, unit: unitOf(i.productId, i.unit) })),
    })),
    payments: db.payments.map((p) => ({
      ...p,
      method: payMethod(p.method),
      bank: p.bank ?? null,
    })),
    invTx: db.invTx.map((t) => ({ ...t, unit: unitOf(t.productId, t.unit) })),
  };
}
