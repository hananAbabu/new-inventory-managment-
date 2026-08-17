'use server';

import { eq, inArray } from 'drizzle-orm';
import { requireUser } from '@/server/auth';
import { schema } from '@/server/db';
import { AppError, mutate } from '@/server/mutate';
import { money, nextRef, num, quantity, writeAudit } from '@/server/workspace';
import { bankShort, needsBank, payMethodLabel } from '@/lib/banks';
import { money as fmtMoney } from '@/lib/selectors';
import type { Bank, PayMethod } from '@/lib/types';
import { formatQty, roundQty } from '@/lib/units';
import type { ActionResult } from './shared';

export interface SaleInput {
  /** Only the product and how much of it — prices come from the database. */
  lines: { productId: number; qty: number }[];
  discountPct: number;
  payMethod: PayMethod;
  bank: Bank | null;
  txnRef: string | null;
  txnPhoto: string | null;
  amountPaid: number;
}

export async function completeSale(input: SaleInput): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'cashier');
    if (!input.lines.length) throw new AppError('The cart is empty');

    const settingsRows = await tx.select().from(schema.settings).limit(1);
    const settings = settingsRows[0];
    const currency = settings?.currency ?? '$';
    const maxDiscount = settings?.maxDiscount ?? 0;
    const taxRate = num(settings?.taxRate ?? '0');

    if (input.discountPct < 0 || input.discountPct > maxDiscount) {
      throw new AppError(`Discount must be between 0 and ${maxDiscount}%`);
    }
    if (needsBank(input.payMethod)) {
      if (!input.bank) throw new AppError('Select the bank that received the payment');
      if (!input.txnRef && !input.txnPhoto) {
        throw new AppError('Enter the transaction number or attach the slip photo');
      }
    }

    const ids = input.lines.map((l) => l.productId);
    // Locked so concurrent registers cannot both sell the last of something.
    const products = await tx
      .select()
      .from(schema.products)
      .where(inArray(schema.products.id, ids))
      .for('update');

    const items = input.lines.map((line) => {
      const p = products.find((x) => x.id === line.productId);
      if (!p) throw new AppError('A product in the cart no longer exists');
      if (!(line.qty > 0)) throw new AppError(`Quantity for ${p.name} must be greater than zero`);
      if (num(p.qty) < line.qty) {
        throw new AppError(`${p.name} has insufficient stock (${formatQty(num(p.qty), p.unit)} left)`);
      }
      return {
        product: p,
        qty: roundQty(line.qty),
        price: num(p.sellPrice),
        cost: num(p.costPrice),
      };
    });

    // Totals are recomputed here; whatever the browser believed is ignored.
    const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
    const discount = (subtotal * input.discountPct) / 100;
    const taxed = subtotal - discount;
    const tax = (taxed * taxRate) / 100;
    const total = roundMoney(taxed + tax);

    const paid = input.payMethod === 'cash' ? input.amountPaid : total;
    if (input.payMethod === 'cash' && !(paid >= total)) {
      throw new AppError('Cash received is less than the total');
    }

    const ref = await nextRef(tx, schema.sales, 'S');
    const saleRows = await tx
      .insert(schema.sales)
      .values({
        ref,
        cashierId: user.id,
        subtotal: money(subtotal),
        discountPct: input.discountPct.toFixed(2),
        discount: money(discount),
        tax: money(tax),
        total: money(total),
        payMethod: input.payMethod,
        bank: needsBank(input.payMethod) ? input.bank : null,
        txnRef: needsBank(input.payMethod) ? input.txnRef : null,
        txnPhoto: needsBank(input.payMethod) ? input.txnPhoto : null,
        amountPaid: money(paid),
        change: money(Math.max(0, paid - total)),
      })
      .returning({ id: schema.sales.id });
    const saleId = saleRows[0].id;

    await tx.insert(schema.saleItems).values(
      items.map((i) => ({
        saleId,
        productId: i.product.id,
        sku: i.product.sku,
        name: i.product.name,
        unit: i.product.unit,
        price: money(i.price),
        cost: money(i.cost),
        qty: quantity(i.qty),
      })),
    );

    await tx.insert(schema.payments).values({
      saleId,
      method: input.payMethod,
      bank: needsBank(input.payMethod) ? input.bank : null,
      amount: money(paid),
    });

    for (const i of items) {
      await tx
        .update(schema.products)
        .set({ qty: quantity(roundQty(num(i.product.qty) - i.qty)), updatedAt: new Date() })
        .where(eq(schema.products.id, i.product.id));

      await tx.insert(schema.inventoryTransactions).values({
        productId: i.product.id,
        sku: i.product.sku,
        name: i.product.name,
        unit: i.product.unit,
        type: 'sale',
        qty: quantity(-i.qty),
        userId: user.id,
        note: 'Sale ' + ref,
      });
    }

    await writeAudit(
      tx,
      user.id,
      'SALE',
      'sale',
      `${ref} · ${fmtMoney(currency, total)} · ${items.length} lines · ${payMethodLabel(
        input.payMethod,
      )}${input.bank ? ' (' + bankShort(input.bank) + ')' : ''}${
        input.txnRef ? ' · ref ' + input.txnRef : ''
      }${input.txnPhoto ? ' · slip attached' : ''}`,
    );
  });
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
