import 'server-only';

import type { Db } from '@/lib/types';

/**
 * Every mutation returns the refreshed workspace so the client can swap its
 * copy wholesale — no diffing, and the UI can never drift from the database.
 */
export type ActionResult =
  | { ok: true; db: Db }
  | { ok: false; error: string };

export type LoadResult =
  | { ok: true; db: Db; userId: number }
  | { ok: false; error: string };
