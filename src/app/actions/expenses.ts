'use server';

import { eq } from 'drizzle-orm';
import { requireUser } from '@/server/auth';
import { schema } from '@/server/db';
import { AppError, mutate } from '@/server/mutate';
import { money, nextRef, num, writeAudit } from '@/server/workspace';
import { needsBank } from '@/lib/banks';
import { money as fmtMoney } from '@/lib/selectors';
import type { Bank, ExpenseCategory, PayMethod } from '@/lib/types';
import type { ActionResult } from './shared';

export interface ExpenseInput {
  date: number;
  category: ExpenseCategory;
  description: string;
  amount: number;
  payMethod: PayMethod;
  bank: Bank | null;
  txnRef: string | null;
}

function validate(input: ExpenseInput) {
  if (!input.description.trim()) throw new AppError('Enter what the money was spent on');
  if (!(input.amount > 0)) throw new AppError('Amount must be greater than zero');
  if (!input.date || isNaN(input.date)) throw new AppError('Enter a valid date');
  if (needsBank(input.payMethod) && !input.bank) throw new AppError('Select the paying bank');
}

async function currency(tx: Parameters<Parameters<typeof mutate>[0]>[0]): Promise<string> {
  const rows = await tx.select().from(schema.settings).limit(1);
  return rows[0]?.currency ?? '$';
}

export async function saveExpense(
  id: number | null,
  input: ExpenseInput,
): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin');
    validate(input);

    const values = {
      date: new Date(input.date),
      category: input.category,
      description: input.description.trim(),
      amount: money(input.amount),
      payMethod: input.payMethod,
      bank: needsBank(input.payMethod) ? input.bank : null,
      txnRef: needsBank(input.payMethod) ? input.txnRef : null,
    };

    const cur = await currency(tx);

    if (id) {
      const rows = await tx
        .select({ ref: schema.expenses.ref })
        .from(schema.expenses)
        .where(eq(schema.expenses.id, id))
        .limit(1);
      if (!rows.length) throw new AppError('That expense no longer exists');

      await tx.update(schema.expenses).set(values).where(eq(schema.expenses.id, id));
      await writeAudit(
        tx,
        user.id,
        'EXPENSE',
        'edit',
        `${rows[0].ref} · ${fmtMoney(cur, input.amount)} · ${values.description}`,
      );
    } else {
      const ref = await nextRef(tx, schema.expenses, 'E');
      await tx.insert(schema.expenses).values({ ...values, ref, byUserId: user.id });
      await writeAudit(
        tx,
        user.id,
        'EXPENSE',
        'add',
        `${ref} · ${fmtMoney(cur, input.amount)} · ${values.description}`,
      );
    }
  });
}

export async function deleteExpense(id: number): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin');
    const rows = await tx
      .select()
      .from(schema.expenses)
      .where(eq(schema.expenses.id, id))
      .limit(1);
    if (!rows.length) throw new AppError('That expense no longer exists');

    await tx.delete(schema.expenses).where(eq(schema.expenses.id, id));
    await writeAudit(
      tx,
      user.id,
      'EXPENSE',
      'delete',
      `Deleted ${rows[0].ref} · ${fmtMoney(await currency(tx), num(rows[0].amount))}`,
    );
  });
}
