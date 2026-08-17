/**
 * Populates Postgres with the starting workspace.
 *
 *   npm run db:seed     fills an empty database, refuses a populated one
 *   npm run db:reset    truncates everything first, then fills
 *
 * The dataset is the same one the client build shipped with, so the catalogue
 * keeps its four standard product configurations.
 */

import { sql } from 'drizzle-orm';
import { closePool, db, schema } from './db';
import { hashPassword } from './auth';
import { money, quantity } from './workspace';
import { seed } from '@/lib/seed';

/** Demo passwords, by username — the seed model carries them in plain text. */
async function run() {
  const reset = process.argv.includes('--reset');

  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length && !reset) {
    console.error('Database already contains data. Use "npm run db:reset" to replace it.');
    process.exitCode = 1;
    await closePool();
    return;
  }

  if (reset) {
    await db.execute(sql`
      TRUNCATE TABLE
        audit_log, inventory_transactions, expenses, payments,
        purchase_items, purchases, sale_items, sales,
        products, suppliers, categories, sessions, users, settings
      RESTART IDENTITY CASCADE
    `);
    console.log('Cleared existing data.');
  }

  const data = seed();

  await db.transaction(async (tx) => {
    await tx.insert(schema.settings).values({
      id: 1,
      shopName: data.settings.shopName,
      currency: data.settings.currency,
      taxRate: data.settings.taxRate.toFixed(2),
      maxDiscount: data.settings.maxDiscount,
      address: data.settings.address,
      phone: data.settings.phone,
      receiptFooter: data.settings.receiptFooter,
    });

    await tx.insert(schema.users).values(
      data.users.map((u) => ({
        id: u.id,
        username: u.username,
        passwordHash: hashPassword(u.password),
        name: u.name,
        role: u.role,
        active: u.active,
        createdAt: new Date(u.createdAt),
      })),
    );

    await tx.insert(schema.categories).values(
      data.categories.map((c) => ({ id: c.id, name: c.name, description: c.description })),
    );

    await tx.insert(schema.suppliers).values(
      data.suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        contact: s.contact,
        phone: s.phone,
        email: s.email,
        address: s.address,
        createdAt: new Date(s.createdAt),
      })),
    );

    await tx.insert(schema.products).values(
      data.products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        categoryId: p.categoryId,
        supplierId: p.supplierId,
        productType: p.productType,
        unit: p.unit,
        kgPerPiece: p.kgPerPiece == null ? null : quantity(p.kgPerPiece),
        piecesPerCarton: p.piecesPerCarton,
        costPrice: money(p.costPrice),
        sellPrice: money(p.sellPrice),
        qty: quantity(p.qty),
        minStock: quantity(p.minStock),
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      })),
    );

    await tx.insert(schema.sales).values(
      data.sales.map((s) => ({
        id: s.id,
        ref: s.ref,
        cashierId: s.cashierId,
        subtotal: money(s.subtotal),
        discountPct: s.discountPct.toFixed(2),
        discount: money(s.discount),
        tax: money(s.tax),
        total: money(s.total),
        payMethod: s.payMethod,
        bank: s.bank,
        txnRef: s.txnRef,
        txnPhoto: s.txnPhoto,
        amountPaid: money(s.amountPaid),
        change: money(s.change),
        createdAt: new Date(s.createdAt),
      })),
    );

    await tx.insert(schema.saleItems).values(
      data.sales.flatMap((s) =>
        s.items.map((i) => ({
          saleId: s.id,
          productId: i.productId,
          sku: i.sku,
          name: i.name,
          unit: i.unit,
          price: money(i.price),
          cost: money(i.cost),
          qty: quantity(i.qty),
        })),
      ),
    );

    await tx.insert(schema.purchases).values(
      data.purchases.map((p) => ({
        id: p.id,
        ref: p.ref,
        supplierId: p.supplierId,
        byUserId: p.byUserId,
        total: money(p.total),
        status: p.status,
        payMethod: p.payMethod,
        bank: p.bank,
        createdAt: new Date(p.createdAt),
        receivedAt: p.receivedAt ? new Date(p.receivedAt) : null,
      })),
    );

    await tx.insert(schema.purchaseItems).values(
      data.purchases.flatMap((p) =>
        p.items.map((i) => ({
          purchaseId: p.id,
          productId: i.productId,
          sku: i.sku,
          name: i.name,
          unit: i.unit,
          qty: quantity(i.qty),
          cost: money(i.cost),
        })),
      ),
    );

    await tx.insert(schema.payments).values(
      data.payments.map((p) => ({
        id: p.id,
        saleId: p.saleId,
        method: p.method,
        bank: p.bank,
        amount: money(p.amount),
        createdAt: new Date(p.createdAt),
      })),
    );

    await tx.insert(schema.expenses).values(
      data.expenses.map((e) => ({
        id: e.id,
        ref: e.ref,
        date: new Date(e.date),
        category: e.category,
        description: e.description,
        amount: money(e.amount),
        payMethod: e.payMethod,
        bank: e.bank,
        txnRef: e.txnRef,
        byUserId: e.byUserId,
        createdAt: new Date(e.createdAt),
      })),
    );

    await tx.insert(schema.inventoryTransactions).values(
      data.invTx.map((t) => ({
        id: t.id,
        date: new Date(t.date),
        productId: t.productId,
        sku: t.sku,
        name: t.name,
        unit: t.unit,
        type: t.type,
        qty: quantity(t.qty),
        userId: t.userId,
        note: t.note,
      })),
    );

    await tx.insert(schema.auditLog).values(
      data.audit.map((a) => ({
        id: a.id,
        date: new Date(a.date),
        userId: a.userId,
        group: a.group,
        action: a.action,
        detail: a.detail,
      })),
    );

    // Explicit ids were supplied above, so the sequences must be moved past them.
    for (const table of [
      'users',
      'categories',
      'suppliers',
      'products',
      'sales',
      'sale_items',
      'purchases',
      'purchase_items',
      'payments',
      'expenses',
      'inventory_transactions',
      'audit_log',
    ]) {
      await tx.execute(
        sql`SELECT setval(
              pg_get_serial_sequence(${table}, 'id'),
              COALESCE((SELECT MAX(id) FROM ${sql.identifier(table)}), 0) + 1,
              false
            )`,
      );
    }
  });

  console.log(
    `Seeded: ${data.products.length} products, ${data.sales.length} sales, ` +
      `${data.purchases.length} purchases, ${data.expenses.length} expenses.`,
  );
  console.log('Sign in with admin / admin123, keeper / keeper123, cashier / cashier123.');
  await closePool();
}

run().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await closePool();
});
