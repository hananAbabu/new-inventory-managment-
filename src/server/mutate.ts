import { db } from './db';
import { AuthError } from './auth';
import { loadWorkspace } from './workspace';
import type { ActionResult } from '@/app/actions/shared';

/** The transaction handle drizzle hands to db.transaction(). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A message meant for the user, not a stack trace. */
export class AppError extends Error {}

/**
 * Runs a mutation in one transaction and returns the refreshed workspace.
 * Anything thrown inside rolls the transaction back; AppError and AuthError
 * surface their message, everything else is logged and reported generically.
 */
export async function mutate(fn: (tx: Tx) => Promise<void>): Promise<ActionResult> {
  try {
    await db.transaction(fn);
    return { ok: true, db: await loadWorkspace() };
  } catch (err) {
    if (err instanceof AppError || err instanceof AuthError) {
      return { ok: false, error: err.message };
    }
    console.error('[mutate]', err);
    return { ok: false, error: 'Something went wrong saving that change.' };
  }
}
