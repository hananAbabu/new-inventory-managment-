'use server';

import { eq } from 'drizzle-orm';
import { db, schema } from '@/server/db';
import {
  createSession,
  currentUser,
  destroySession,
  verifyPassword,
} from '@/server/auth';
import { loadWorkspace } from '@/server/workspace';
import type { LoadResult } from './shared';

/** The only thing the sign-in screen may read before authenticating. */
export async function fetchPublicSettings(): Promise<{ shopName: string }> {
  const rows = await db.select({ shopName: schema.settings.shopName }).from(schema.settings).limit(1);
  return { shopName: rows[0]?.shopName ?? 'Inventory System' };
}

/** Called by the store on mount. Returns null-ish when nobody is signed in. */
export async function fetchWorkspace(): Promise<LoadResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  return { ok: true, db: await loadWorkspace(), userId: user.id };
}

export async function signIn(username: string, password: string): Promise<LoadResult> {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username.trim().toLowerCase()))
    .limit(1);

  const user = rows[0];
  // Same message either way, so the form cannot be used to discover usernames.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: 'Invalid username or password.' };
  }
  if (!user.active) {
    return { ok: false, error: 'This account has been deactivated. Contact the owner.' };
  }

  await createSession(user.id);
  return { ok: true, db: await loadWorkspace(), userId: user.id };
}

export async function signOut(): Promise<void> {
  await destroySession();
}
