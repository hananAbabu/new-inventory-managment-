'use server';

import { eq, inArray } from 'drizzle-orm';
import { requireUser } from '@/server/auth';
import { schema } from '@/server/db';
import { AppError, mutate, type Tx } from '@/server/mutate';
import { money, nextRef, num, quantity, writeAudit } from '@/server/workspace';
import { needsBank } from '@/lib/banks';
import { money as fmtMoney } from '@/lib/selectors';
import type { Bank, PayMethod, StockLocation } from '@/lib/types';
import { roundQty } from '@/lib/units';
import type { ActionResult } from './shared';

export interface PurchaseInput {
  /** Which stock the delivery lands in. */
  location?: StockLocation;
  /** Money handed over now; the rest is owed to the supplier. */
  amountPaid?: number;
  supplierId: number;
  payMethod: PayMethod;
  bank: Bank | null;
  /** Quantities are already converted to stock units by the caller. */
  lines: { productId: number; qty: number; cost: number }[];
  receive: boolean;
}

async function buildItems(tx: Tx, lines: PurchaseInput['lines']) {
  if (!lines.length) throw new AppError('Add at least one product line');
  const ids = lines.map((l) => l.productId);
  const products = await tx.select().from(schema.products).where(inArray(schema.products.id, ids));

  return lines.map((l) => {
    const p = products.find((x) => x.id === l.productId);
    if (!p) throw new AppError('A product on this order no longer exists');
    if (!(l.qty > 0)) throw new AppError(`Quantity for ${p.name} must be greater than zero`);
    if (!(l.cost >= 0)) throw new AppError(`Cost for ${p.name} must be zero or more`);
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      qty: roundQty(l.qty),
      cost: l.cost,
    };
  });
}

/** Moves an order's goods into stock and logs each line. */
async function applyReceive(tx: Tx, purchaseId: number, userId: number) {
  const orderRows = await tx
    .select({ location: schema.purchases.location })
    .from(schema.purchases)
    .where(eq(schema.purchases.id, purchaseId))
    .limit(1);
  const location = orderRows[0]?.location ?? 'store';

  const purRows = await tx
    .select()
    .from(schema.purchases)
    .where(eq(schema.purchases.id, purchaseId))
    .limit(1);
  const pur = purRows[0];
  if (!pur) throw new AppError('That order no longer exists');
  if (pur.status === 'received') return;

  const items = await tx
    .select()
    .from(schema.purchaseItems)
    .where(eq(schema.purchaseItems.purchaseId, purchaseId));

  for (const it of items) {
    const rows = await tx
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, it.productId))
      .for('update')
      .limit(1);
    const p = rows[0];
    if (!p) continue;

    await tx
      .update(schema.products)
      .set({
        // Deliveries land in the location the order names.
        ...(location === 'shop'
          ? { qtyShop: quantity(roundQty(num(p.qtyShop) + num(it.qty))) }
          : { qtyStore: quantity(roundQty(num(p.qtyStore) + num(it.qty))) }),
        // Receiving restates what the stock cost.
        costPrice: it.cost,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, p.id));

    await tx.insert(schema.inventoryTransactions).values({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      type: 'purchase',
      qty: it.qty,
      userId,
      note: 'Purchase ' + pur.ref,
    });
  }

  await tx
    .update(schema.purchases)
    .set({ status: 'received', receivedAt: new Date() })
    .where(eq(schema.purchases.id, purchaseId));
}

export async function createPurchase(input: PurchaseInput): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');
    if (needsBank(input.payMethod) && !input.bank) throw new AppError('Select the paying bank');

    const items = await buildItems(tx, input.lines);
    const total = items.reduce((a, i) => a + i.qty * i.cost, 0);
    const ref = await nextRef(tx, schema.purchases, 'P');

    const rows = await tx
      .insert(schema.purchases)
      .values({
        ref,
        supplierId: input.supplierId,
        byUserId: user.id,
        total: money(total),
        status: 'ordered',
        payMethod: input.payMethod,
        bank: needsBank(input.payMethod) ? input.bank : null,
      })
      .returning({ id: schema.purchases.id });
    const purchaseId = rows[0].id;

    await tx.insert(schema.purchaseItems).values(
      items.map((i) => ({
        purchaseId,
        productId: i.productId,
        sku: i.sku,
        name: i.name,
        unit: i.unit,
        qty: quantity(i.qty),
        cost: money(i.cost),
      })),
    );

    if (input.receive) await applyReceive(tx, purchaseId, user.id);

    const settings = (await tx.select().from(schema.settings).limit(1))[0];
    await writeAudit(
      tx,
      user.id,
      'PURCHASE',
      input.receive ? 'create+receive' : 'create',
      `${ref} · ${fmtMoney(settings?.currency ?? '$', total)}`,
    );
  });
}

export async function updatePurchase(id: number, input: PurchaseInput): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');

    const rows = await tx
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, id))
      .for('update')
      .limit(1);
    const pur = rows[0];
    if (!pur) throw new AppError('That order no longer exists');
    if (pur.status === 'received') {
      throw new AppError('Received orders cannot be edited — their stock is already in the log');
    }

    const items = await buildItems(tx, input.lines);
    const total = items.reduce((a, i) => a + i.qty * i.cost, 0);

    await tx
      .update(schema.purchases)
      .set({
        supplierId: input.supplierId,
        payMethod: input.payMethod,
        bank: needsBank(input.payMethod) ? input.bank : null,
        total: money(total),
      })
      .where(eq(schema.purchases.id, id));

    await tx.delete(schema.purchaseItems).where(eq(schema.purchaseItems.purchaseId, id));
    await tx.insert(schema.purchaseItems).values(
      items.map((i) => ({
        purchaseId: id,
        productId: i.productId,
        sku: i.sku,
        name: i.name,
        unit: i.unit,
        qty: quantity(i.qty),
        cost: money(i.cost),
      })),
    );

    if (input.receive) await applyReceive(tx, id, user.id);

    const settings = (await tx.select().from(schema.settings).limit(1))[0];
    await writeAudit(
      tx,
      user.id,
      'PURCHASE',
      input.receive ? 'edit+receive' : 'edit',
      `${pur.ref} · ${fmtMoney(settings?.currency ?? '$', total)}`,
    );
  });
}

export async function receivePurchase(id: number): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');
    const rows = await tx
      .select({ ref: schema.purchases.ref, status: schema.purchases.status })
      .from(schema.purchases)
      .where(eq(schema.purchases.id, id))
      .limit(1);
    if (!rows.length) throw new AppError('That order no longer exists');
    if (rows[0].status === 'received') throw new AppError('That order is already received');

    await applyReceive(tx, id, user.id);
    await writeAudit(tx, user.id, 'PURCHASE', 'receive', `${rows[0].ref} received into stock`);
  });
}

export async function deletePurchase(id: number): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');
    const rows = await tx
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, id))
      .limit(1);
    const pur = rows[0];
    if (!pur) throw new AppError('That order no longer exists');
    if (pur.status === 'received') {
      throw new AppError('Received orders cannot be deleted — their stock is already in the log');
    }

    await tx.delete(schema.purchases).where(eq(schema.purchases.id, id));
    const settings = (await tx.select().from(schema.settings).limit(1))[0];
    await writeAudit(
      tx,
      user.id,
      'PURCHASE',
      'delete',
      `Deleted order ${pur.ref} · ${fmtMoney(settings?.currency ?? '$', num(pur.total))}`,
    );
  });
}
