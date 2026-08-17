'use server';

import { and, eq, sql } from 'drizzle-orm';
import { hashPassword, requireUser } from '@/server/auth';
import { schema } from '@/server/db';
import { AppError, mutate, type Tx } from '@/server/mutate';
import { writeAudit } from '@/server/workspace';
import type { Role } from '@/lib/types';
import type { ActionResult } from './shared';

async function activeAdmins(tx: Tx): Promise<number> {
  const rows = await tx
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.role, 'admin'), eq(schema.users.active, true)));
  return rows.length;
}

export async function saveUser(
  id: number | null,
  input: { name: string; username: string; role: Role; password: string },
): Promise<ActionResult> {
  return mutate(async (tx) => {
    const me = await requireUser('admin');
    const name = input.name.trim();
    const username = input.username.trim().toLowerCase();
    if (!name || !username) throw new AppError('Name and username are required');

    const clash = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(sql`lower(${schema.users.username})`, username));
    if (clash.some((u) => u.id !== id)) throw new AppError('Username already taken');

    if (id) {
      const rows = await tx.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
      const target = rows[0];
      if (!target) throw new AppError('That user no longer exists');

      if (target.role === 'admin' && input.role !== 'admin' && (await activeAdmins(tx)) <= 1) {
        throw new AppError('Cannot demote the last active admin');
      }

      await tx
        .update(schema.users)
        .set({
          name,
          username,
          role: input.role,
          ...(input.password ? { passwordHash: hashPassword(input.password) } : {}),
        })
        .where(eq(schema.users.id, id));
      await writeAudit(tx, me.id, 'USER', 'edit', `Updated user ${username} (role: ${input.role})`);
    } else {
      if (!input.password || input.password.length < 4) {
        throw new AppError('Password must be at least 4 characters');
      }
      await tx.insert(schema.users).values({
        name,
        username,
        passwordHash: hashPassword(input.password),
        role: input.role,
        active: true,
      });
      await writeAudit(tx, me.id, 'USER', 'add', `Created user ${username} (role: ${input.role})`);
    }
  });
}

export async function toggleUserActive(id: number): Promise<ActionResult> {
  return mutate(async (tx) => {
    const me = await requireUser('admin');
    if (id === me.id) throw new AppError('You cannot deactivate your own account');

    const rows = await tx.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    const target = rows[0];
    if (!target) throw new AppError('That user no longer exists');

    if (target.role === 'admin' && target.active && (await activeAdmins(tx)) <= 1) {
      throw new AppError('Cannot deactivate the last active admin');
    }

    const nextActive = !target.active;
    await tx.update(schema.users).set({ active: nextActive }).where(eq(schema.users.id, id));
    // Deactivating must also cut off any session that account already holds.
    if (!nextActive) await tx.delete(schema.sessions).where(eq(schema.sessions.userId, id));

    await writeAudit(
      tx,
      me.id,
      'USER',
      nextActive ? 'activate' : 'deactivate',
      `User ${target.username} ${nextActive ? 'activated' : 'deactivated'}`,
    );
  });
}

export async function deleteUser(id: number): Promise<ActionResult> {
  return mutate(async (tx) => {
    const me = await requireUser('admin');
    if (id === me.id) throw new AppError('You cannot delete your own account');

    const rows = await tx.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    const target = rows[0];
    if (!target) throw new AppError('That user no longer exists');
    if (target.role === 'admin' && (await activeAdmins(tx)) <= 1) {
      throw new AppError('Cannot delete the last active admin');
    }

    const hasSales = await tx
      .select({ id: schema.sales.id })
      .from(schema.sales)
      .where(eq(schema.sales.cashierId, id))
      .limit(1);
    if (hasSales.length) {
      throw new AppError(
        'This user has sales history — deactivate the account instead of deleting it',
      );
    }

    await tx.delete(schema.users).where(eq(schema.users.id, id));
    await writeAudit(tx, me.id, 'USER', 'delete', `Deleted user ${target.username}`);
  });
}

export async function updateSettings(input: {
  shopName: string;
  currency: string;
  taxRate: number;
  maxDiscount: number;
  phone: string;
  address: string;
  receiptFooter: string;
}): Promise<ActionResult> {
  return mutate(async (tx) => {
    const me = await requireUser('admin');
    if (input.taxRate < 0 || input.taxRate > 30) {
      throw new AppError('Tax rate must be between 0 and 30');
    }
    if (isNaN(input.maxDiscount) || input.maxDiscount < 0 || input.maxDiscount > 100) {
      throw new AppError('Max discount must be 0–100');
    }

    await tx
      .update(schema.settings)
      .set({
        shopName: input.shopName.trim() || 'Inventory',
        currency: input.currency || '$',
        taxRate: input.taxRate.toFixed(2),
        maxDiscount: input.maxDiscount,
        phone: input.phone.trim(),
        address: input.address.trim(),
        receiptFooter: input.receiptFooter.trim(),
      })
      .where(eq(schema.settings.id, 1));

    await writeAudit(tx, me.id, 'SETTINGS', 'update', 'Updated system settings');
  });
}
