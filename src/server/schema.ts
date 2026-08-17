import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* ---------------- enums ---------------- */

export const roleEnum = pgEnum('role', ['admin', 'storekeeper', 'cashier']);
export const payMethodEnum = pgEnum('pay_method', ['cash', 'transfer', 'credit']);
/** Where stock sits: the back store or the shop counter. */
export const stockLocationEnum = pgEnum('stock_location', ['store', 'shop']);
/** How much of an invoice has actually been settled. */
export const paymentStatusEnum = pgEnum('payment_status', ['paid', 'partial', 'pending']);
/** A payment belongs to a sale or a purchase, never both. */
export const paymentPartyEnum = pgEnum('payment_party', ['sale', 'purchase']);
export const bankEnum = pgEnum('bank', [
  'cbe',
  'boa',
  'awash',
  'dashen',
  'coop',
  'oromiya',
  'shebele',
  'check',
]);
export const unitEnum = pgEnum('unit', ['pcs', 'kg', 'l', 'carton']);
export const productTypeEnum = pgEnum('product_type', [
  'weight',
  'piece',
  'carton',
  'carton-piece',
  'unset',
]);
export const purchaseStatusEnum = pgEnum('purchase_status', ['ordered', 'received']);
export const txTypeEnum = pgEnum('tx_type', [
  'initial',
  'purchase',
  'sale',
  'received',
  'damage',
  'lost',
  'adjustment',
]);
export const expenseCategoryEnum = pgEnum('expense_category', [
  'rent',
  'salary',
  'transport',
  'utilities',
  'supplies',
  'maintenance',
  'tax',
  'other',
]);

/* ---------------- money and quantity ----------------
 * Money is numeric(12,2); quantities are numeric(12,3) so kilograms and litres
 * keep their fractions. Both come back from pg as strings and are parsed at the
 * serialisation boundary.
 */

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
const qty = (name: string) => numeric(name, { precision: 12, scale: 3 });

/* ---------------- tables ---------------- */

/** Single-row table holding shop configuration. */
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  shopName: text('shop_name').notNull(),
  currency: text('currency').notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull(),
  maxDiscount: integer('max_discount').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  receiptFooter: text('receipt_footer').notNull(),
});

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: roleEnum('role').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_username_key').on(t.username)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
  },
  (t) => [uniqueIndex('categories_name_key').on(t.name)],
);

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  contact: text('contact').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  address: text('address').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable(
  'customers',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone').notNull().default(''),
    address: text('address').notNull().default(''),
    note: text('note').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customers_name_key').on(t.name)],
);

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    productType: productTypeEnum('product_type').notNull().default('piece'),
    unit: unitEnum('unit').notNull().default('pcs'),
    /** Weight-based: kilograms in one sack. */
    kgPerPiece: qty('kg_per_piece'),
    /** Carton types: retail pieces inside one carton. */
    piecesPerCarton: integer('pieces_per_carton'),
    costPrice: money('cost_price').notNull(),
    sellPrice: money('sell_price').notNull(),
    /** Warehouse stock. */
    qtyStore: qty('qty_store').notNull().default('0'),
    /** Counter stock. */
    qtyShop: qty('qty_shop').notNull().default('0'),
    /** Store + shop. Generated, so the total can never drift from its parts. */
    qty: qty('qty').generatedAlwaysAs(sql`qty_store + qty_shop`),
    minStock: qty('min_stock').notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('products_sku_key').on(t.sku)],
);

export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    ref: text('ref').notNull(),
    cashierId: integer('cashier_id')
      .notNull()
      .references(() => users.id),
    subtotal: money('subtotal').notNull(),
    discountPct: numeric('discount_pct', { precision: 5, scale: 2 }).notNull().default('0'),
    discount: money('discount').notNull().default('0'),
    tax: money('tax').notNull().default('0'),
    total: money('total').notNull(),
    payMethod: payMethodEnum('pay_method').notNull(),
    bank: bankEnum('bank'),
    txnRef: text('txn_ref'),
    /** Compressed transfer slip, stored as a data URL. */
    txnPhoto: text('txn_photo'),
    /** Required once anything is left owing — somebody has to be on the hook for it. */
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
    location: stockLocationEnum('location').notNull().default('shop'),
    amountPaid: money('amount_paid').notNull(),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('paid'),
    change: money('change_due').notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sales_ref_key').on(t.ref), index('sales_created_idx').on(t.createdAt)],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: serial('id').primaryKey(),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    unit: unitEnum('unit').notNull(),
    price: money('unit_price').notNull(),
    cost: money('unit_cost').notNull(),
    qty: qty('qty').notNull(),
  },
  (t) => [index('sale_items_sale_idx').on(t.saleId)],
);

export const purchases = pgTable(
  'purchases',
  {
    id: serial('id').primaryKey(),
    ref: text('ref').notNull(),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    byUserId: integer('by_user_id')
      .notNull()
      .references(() => users.id),
    total: money('total').notNull(),
    status: purchaseStatusEnum('status').notNull().default('ordered'),
    payMethod: payMethodEnum('pay_method').notNull().default('cash'),
    bank: bankEnum('bank'),
    amountPaid: money('amount_paid').notNull().default('0'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('paid'),
    location: stockLocationEnum('location').notNull().default('store'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    receivedAt: timestamp('received_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('purchases_ref_key').on(t.ref)],
);

export const purchaseItems = pgTable(
  'purchase_items',
  {
    id: serial('id').primaryKey(),
    purchaseId: integer('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    unit: unitEnum('unit').notNull(),
    qty: qty('qty').notNull(),
    cost: money('unit_cost').notNull(),
  },
  (t) => [index('purchase_items_purchase_idx').on(t.purchaseId)],
);

/**
 * One instalment against a sale or a purchase. The amount_paid and payment_status
 * columns on those tables are caches recomputed from these rows, so "100 now, 100
 * next week" is kept as two dated payments rather than a single overwritten number.
 */
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    party: paymentPartyEnum('party').notNull().default('sale'),
    saleId: integer('sale_id').references(() => sales.id, { onDelete: 'cascade' }),
    purchaseId: integer('purchase_id').references(() => purchases.id, { onDelete: 'cascade' }),
    method: payMethodEnum('method').notNull(),
    bank: bankEnum('bank'),
    amount: money('amount').notNull(),
    txnRef: text('txn_ref'),
    note: text('note').notNull().default(''),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
    takenByUserId: integer('taken_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payments_sale_idx').on(t.saleId),
    index('payments_purchase_idx').on(t.purchaseId),
    check(
      'payments_one_party',
      sql`(party = 'sale' AND sale_id IS NOT NULL AND purchase_id IS NULL)
       OR (party = 'purchase' AND purchase_id IS NOT NULL AND sale_id IS NULL)`,
    ),
    check('payments_amount_positive', sql`amount > 0`),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: serial('id').primaryKey(),
    ref: text('ref').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    category: expenseCategoryEnum('category').notNull(),
    description: text('description').notNull(),
    amount: money('amount').notNull(),
    payMethod: payMethodEnum('pay_method').notNull(),
    bank: bankEnum('bank'),
    txnRef: text('txn_ref'),
    byUserId: integer('by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('expenses_ref_key').on(t.ref), index('expenses_date_idx').on(t.date)],
);

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: serial('id').primaryKey(),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    unit: unitEnum('unit').notNull(),
    type: txTypeEnum('type').notNull(),
    /** Which stock this movement touched. */
    location: stockLocationEnum('location').notNull().default('store'),
    /** Signed: positive in, negative out. */
    qty: qty('qty').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    note: text('note').notNull().default(''),
  },
  (t) => [index('inv_tx_date_idx').on(t.date), index('inv_tx_product_idx').on(t.productId)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    group: text('grp').notNull(),
    action: text('action').notNull(),
    detail: text('detail').notNull().default(''),
  },
  (t) => [index('audit_date_idx').on(t.date)],
);
