/**
 * Read-path and schema smoke test: `npx tsx --env-file=.env.local src/server/verify.ts`
 *
 * Checks that the workspace loads in the shape the client expects, that seeded
 * passwords verify, and that a full sale round-trips through the real tables.
 * The write test runs inside a transaction that is always rolled back.
 */

import { eq } from 'drizzle-orm';
import { closePool, db, schema } from './db';
import { verifyPassword } from './auth';
import { loadWorkspace, money, num, nextRef, quantity } from './workspace';

let failures = 0;

function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

class Rollback extends Error {}

async function main() {
  const ws = await loadWorkspace();

  check('workspace loads', !!ws.settings.shopName, ws.settings.shopName);
  // Assert the seeded catalogue is intact rather than an exact count, which drifts
  // as soon as anyone adds a product by hand.
  const seededSkus = ['SG-1001', 'PA-2001', 'PL-3001', 'RC-4001', 'OL-5001', 'OL-5005', 'PL-3003'];
  check(
    'seeded catalogue present',
    seededSkus.every((sku) => ws.products.some((p) => p.sku === sku)),
    `${ws.products.length} products`,
  );
  // A migrated database starts with no customers, which is correct — only assert
  // the table loads into the workspace.
  check('customers load', Array.isArray(ws.customers), `${ws.customers.length} customers`);
  check(
    'stock split across locations',
    ws.products.every((p) => Math.abs(p.qtyStore + p.qtyShop - p.qty) < 0.001),
    'store + shop equals the generated total',
  );
  check('sales present', ws.sales.length > 0, `${ws.sales.length} sales`);
  check('expenses present', ws.expenses.length === 8, `${ws.expenses.length} expenses`);

  const sugar = ws.products.find((p) => p.sku === 'SG-1001')!;
  check('weight product configured', sugar.productType === 'weight' && sugar.kgPerPiece === 50,
    `${sugar.name}: ${sugar.productType}, ${sugar.kgPerPiece} kg/sack`);

  const omar = ws.products.find((p) => p.sku === 'OL-5005')!;
  check('carton-piece configured', omar.productType === 'carton-piece' && omar.piecesPerCarton === 4,
    `${omar.name}: ${omar.piecesPerCarton} pcs/carton, priced per ${omar.unit}`);

  const bakela = ws.products.find((p) => p.sku === 'PL-3003')!;
  check('Bakela left unconfigured', bakela.productType === 'unset');

  // Numerics must come back as numbers, not the strings pg hands over.
  check('numerics parsed', typeof sugar.qty === 'number' && typeof sugar.sellPrice === 'number',
    `qty ${sugar.qty} (${typeof sugar.qty})`);
  check('timestamps are epoch ms', typeof ws.sales[0].createdAt === 'number');

  // Embedded item arrays are rebuilt from the child tables.
  const withItems = ws.sales.find((s) => s.items.length > 1);
  check('sale items rebuilt', !!withItems, `sale ${withItems?.ref} has ${withItems?.items.length} lines`);
  check('purchase items rebuilt', ws.purchases.every((p) => p.items.length > 0));

  // Passwords are hashed, and the hash never reaches the client model.
  const rows = await db.select().from(schema.users).where(eq(schema.users.username, 'admin')).limit(1);
  check('password hashed', rows[0].passwordHash.startsWith('$2'), rows[0].passwordHash.slice(0, 7) + '…');
  check('correct password verifies', verifyPassword('admin123', rows[0].passwordHash));
  check('wrong password rejected', !verifyPassword('wrong', rows[0].passwordHash));
  check('hash withheld from workspace', ws.users.every((u) => u.password === ''));

  // A sale, written the way the action writes it, then rolled back.
  const before = num(
    (await db.select().from(schema.products).where(eq(schema.products.id, sugar.id)))[0].qtyStore,
  );
  try {
    await db.transaction(async (tx) => {
      const ref = await nextRef(tx, schema.sales, 'S');
      const sale = await tx
        .insert(schema.sales)
        .values({
          ref,
          cashierId: 1,
          subtotal: money(680),
          discount: money(0),
          tax: money(0),
          total: money(680),
          payMethod: 'transfer',
          bank: 'cbe',
          txnRef: 'VERIFY-1',
          amountPaid: money(680),
          change: money(0),
        })
        .returning({ id: schema.sales.id });

      await tx.insert(schema.saleItems).values({
        saleId: sale[0].id,
        productId: sugar.id,
        sku: sugar.sku,
        name: sugar.name,
        unit: sugar.unit,
        price: money(68),
        cost: money(62),
        qty: quantity(10),
      });
      await tx
        .update(schema.products)
        .set({ qtyStore: quantity(before - 10) })
        .where(eq(schema.products.id, sugar.id));

      const after = num(
        (await tx.select().from(schema.products).where(eq(schema.products.id, sugar.id)))[0].qtyStore,
      );
          check(
        'sale writes and decrements stock',
        before > 10 && after === before - 10 && after >= 0,
        `${before} → ${after} kg`,
      );
      check('reference generated', /^S-\d{5}$/.test(ref), ref);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }

  const restored = num(
    (await db.select().from(schema.products).where(eq(schema.products.id, sugar.id)))[0].qtyStore,
  );
  check('transaction rolled back cleanly', restored === before, `${restored} kg`);

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
  process.exitCode = failures ? 1 : 0;
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await closePool();
});
