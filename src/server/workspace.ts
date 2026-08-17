import { asc, desc, eq } from 'drizzle-orm';
import { db, schema } from './db';
import type { Tx } from './mutate';
import type {
  AuditEntry,
  Category,
  Db,
  Expense,
  InvTx,
  Payment,
  Product,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  Settings,
  Supplier,
  User,
} from '@/lib/types';

/* ---------------- column conversions ----------------
 * pg returns numeric as string to protect precision, and timestamps as Date.
 * The client model uses plain numbers and epoch milliseconds, so every read
 * crosses this boundary and every write crosses back.
 */

export const num = (v: string | null): number => (v == null ? 0 : Number(v));
export const numOrNull = (v: string | null): number | null => (v == null ? null : Number(v));
export const ms = (d: Date | null): number => (d ? d.getTime() : 0);
export const msOrNull = (d: Date | null): number | null => (d ? d.getTime() : null);

/** Money and quantities go back as fixed-precision strings. */
export const money = (n: number): string => n.toFixed(2);
export const quantity = (n: number): string => n.toFixed(3);

/**
 * Loads the entire workspace in the shape the client store expects. One shop's
 * data is small enough that this is a handful of indexed reads, and it keeps
 * every page working against the same object it always has.
 */
export async function loadWorkspace(): Promise<Db> {
  const [
    settingsRows,
    userRows,
    categoryRows,
    supplierRows,
    productRows,
    saleRows,
    saleItemRows,
    purchaseRows,
    purchaseItemRows,
    paymentRows,
    expenseRows,
    invTxRows,
    auditRows,
  ] = await Promise.all([
    db.select().from(schema.settings).limit(1),
    db.select().from(schema.users).orderBy(asc(schema.users.id)),
    db.select().from(schema.categories).orderBy(asc(schema.categories.id)),
    db.select().from(schema.suppliers).orderBy(asc(schema.suppliers.id)),
    db.select().from(schema.products).orderBy(asc(schema.products.id)),
    db.select().from(schema.sales).orderBy(asc(schema.sales.id)),
    db.select().from(schema.saleItems).orderBy(asc(schema.saleItems.id)),
    db.select().from(schema.purchases).orderBy(asc(schema.purchases.id)),
    db.select().from(schema.purchaseItems).orderBy(asc(schema.purchaseItems.id)),
    db.select().from(schema.payments).orderBy(asc(schema.payments.id)),
    db.select().from(schema.expenses).orderBy(asc(schema.expenses.id)),
    db.select().from(schema.inventoryTransactions).orderBy(asc(schema.inventoryTransactions.id)),
    db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.date)).limit(500),
  ]);

  const s = settingsRows[0];
  const settings: Settings = {
    shopName: s?.shopName ?? 'Inventory',
    currency: s?.currency ?? '$',
    taxRate: num(s?.taxRate ?? '0'),
    maxDiscount: s?.maxDiscount ?? 0,
    address: s?.address ?? '',
    phone: s?.phone ?? '',
    receiptFooter: s?.receiptFooter ?? '',
  };

  const users: User[] = userRows.map((u) => ({
    id: u.id,
    username: u.username,
    // The hash never leaves the server; the client model keeps the field shape.
    password: '',
    name: u.name,
    role: u.role,
    active: u.active,
    createdAt: ms(u.createdAt),
  }));

  const categories: Category[] = categoryRows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
  }));

  const suppliers: Supplier[] = supplierRows.map((x) => ({
    id: x.id,
    name: x.name,
    contact: x.contact,
    phone: x.phone,
    email: x.email,
    address: x.address,
    createdAt: ms(x.createdAt),
  }));

  const products: Product[] = productRows.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    categoryId: p.categoryId,
    supplierId: p.supplierId,
    productType: p.productType,
    unit: p.unit,
    kgPerPiece: numOrNull(p.kgPerPiece),
    piecesPerCarton: p.piecesPerCarton,
    costPrice: num(p.costPrice),
    sellPrice: num(p.sellPrice),
    qty: num(p.qty),
    minStock: num(p.minStock),
    createdAt: ms(p.createdAt),
    updatedAt: ms(p.updatedAt),
  }));

  const itemsBySale = new Map<number, SaleItem[]>();
  saleItemRows.forEach((i) => {
    const list = itemsBySale.get(i.saleId) ?? [];
    list.push({
      productId: i.productId,
      sku: i.sku,
      name: i.name,
      unit: i.unit,
      price: num(i.price),
      cost: num(i.cost),
      qty: num(i.qty),
    });
    itemsBySale.set(i.saleId, list);
  });

  const sales: Sale[] = saleRows.map((x) => ({
    id: x.id,
    ref: x.ref,
    cashierId: x.cashierId,
    items: itemsBySale.get(x.id) ?? [],
    subtotal: num(x.subtotal),
    discountPct: num(x.discountPct),
    discount: num(x.discount),
    tax: num(x.tax),
    total: num(x.total),
    payMethod: x.payMethod,
    bank: x.bank,
    txnRef: x.txnRef,
    txnPhoto: x.txnPhoto,
    amountPaid: num(x.amountPaid),
    change: num(x.change),
    createdAt: ms(x.createdAt),
  }));

  const itemsByPurchase = new Map<number, PurchaseItem[]>();
  purchaseItemRows.forEach((i) => {
    const list = itemsByPurchase.get(i.purchaseId) ?? [];
    list.push({
      productId: i.productId,
      sku: i.sku,
      name: i.name,
      unit: i.unit,
      qty: num(i.qty),
      cost: num(i.cost),
    });
    itemsByPurchase.set(i.purchaseId, list);
  });

  const purchases: Purchase[] = purchaseRows.map((x) => ({
    id: x.id,
    ref: x.ref,
    supplierId: x.supplierId,
    byUserId: x.byUserId,
    items: itemsByPurchase.get(x.id) ?? [],
    total: num(x.total),
    status: x.status,
    payMethod: x.payMethod,
    bank: x.bank,
    createdAt: ms(x.createdAt),
    receivedAt: msOrNull(x.receivedAt),
  }));

  const payments: Payment[] = paymentRows.map((x) => ({
    id: x.id,
    saleId: x.saleId,
    method: x.method,
    bank: x.bank,
    amount: num(x.amount),
    createdAt: ms(x.createdAt),
  }));

  const expenses: Expense[] = expenseRows.map((x) => ({
    id: x.id,
    ref: x.ref,
    date: ms(x.date),
    category: x.category,
    description: x.description,
    amount: num(x.amount),
    payMethod: x.payMethod,
    bank: x.bank,
    txnRef: x.txnRef,
    byUserId: x.byUserId,
    createdAt: ms(x.createdAt),
  }));

  const invTx: InvTx[] = invTxRows.map((x) => ({
    id: x.id,
    date: ms(x.date),
    productId: x.productId,
    sku: x.sku,
    name: x.name,
    unit: x.unit,
    type: x.type,
    qty: num(x.qty),
    userId: x.userId,
    note: x.note,
  }));

  const audit: AuditEntry[] = auditRows.map((x) => ({
    id: x.id,
    date: ms(x.date),
    userId: x.userId,
    group: x.group,
    action: x.action,
    detail: x.detail,
  }));

  return {
    settings,
    users,
    categories,
    suppliers,
    products,
    sales,
    purchases,
    payments,
    expenses,
    invTx,
    audit,
  };
}

/** Appends an audit row. Call inside the same transaction as the change it describes. */
export async function writeAudit(
  tx: Tx,
  userId: number | null,
  group: string,
  action: string,
  detail: string,
): Promise<void> {
  await tx.insert(schema.auditLog).values({ userId, group, action, detail });
}

/** Next free reference in the S-00001 / P-00001 / E-00001 style. */
export async function nextRef(
  tx: Tx,
  table: typeof schema.sales | typeof schema.purchases | typeof schema.expenses,
  prefix: string,
): Promise<string> {
  const rows = await tx.select({ ref: table.ref }).from(table);
  let max = 0;
  rows.forEach((r) => {
    const n = parseInt(String(r.ref).split('-')[1], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return `${prefix}-${String(max + 1).padStart(5, '0')}`;
}

export { eq };
