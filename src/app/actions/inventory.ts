'use server';

import { eq } from 'drizzle-orm';
import { requireUser } from '@/server/auth';
import { schema } from '@/server/db';
import { AppError, mutate } from '@/server/mutate';
import { num, quantity, writeAudit } from '@/server/workspace';
import type { StockLocation, TxType } from '@/lib/types';
import { formatQty, roundQty } from '@/lib/units';
import type { ActionResult } from './shared';

type MovementType = Extract<TxType, 'received' | 'damage' | 'lost' | 'adjustment'>;

export async function recordMovement(input: {
  productId: number;
  type: MovementType;
  qty: number;
  location?: StockLocation;
  note: string;
}): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');

    // Locked for the transaction so two movements cannot race the same row.
    const rows = await tx
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, input.productId))
      .for('update')
      .limit(1);
    const p = rows[0];
    if (!p) throw new AppError('Select a product');

    if (!input.qty || isNaN(input.qty)) throw new AppError('Quantity cannot be zero');
    if (input.type !== 'adjustment' && input.qty < 0) {
      throw new AppError('Quantity must be positive for this type');
    }

    const delta =
      input.type === 'received' || input.type === 'adjustment' ? input.qty : -input.qty;
    // A movement affects one location, so it is that location's count that must cover it.
    const location = input.location ?? 'store';
    const held = location === 'shop' ? num(p.qtyShop) : num(p.qtyStore);
    const after = roundQty(held + delta);
    if (after < 0) {
      throw new AppError(
        `Insufficient ${location} stock — only ${formatQty(held, p.unit)} on hand`,
      );
    }

    await tx
      .update(schema.products)
      .set(
        location === 'shop'
          ? { qtyShop: quantity(after), updatedAt: new Date() }
          : { qtyStore: quantity(after), updatedAt: new Date() },
      )
      .where(eq(schema.products.id, p.id));

    await tx.insert(schema.inventoryTransactions).values({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      type: input.type,
      qty: quantity(delta),
      location,
      userId: user.id,
      note: input.note.trim(),
    });

    await writeAudit(
      tx,
      user.id,
      'INVENTORY',
      input.type,
      `${delta > 0 ? '+' : ''}${formatQty(delta, p.unit)} · ${p.sku}${
        input.note.trim() ? ' · ' + input.note.trim() : ''
      }`,
    );
  });
}
