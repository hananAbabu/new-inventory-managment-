import bcrypt from 'bcryptjs';
import { and, eq, gt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { db, schema } from './db';
import type { Role } from '@/lib/types';

const COOKIE = 'inventory_session';
const SESSION_DAYS = 7;

export interface SessionUser {
  id: number;
  name: string;
  username: string;
  role: Role;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export async function createSession(userId: number): Promise<void> {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ id, userId, expiresAt });

  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  jar.delete(COOKIE);
}

/** The signed-in user, or null. Every server action starts here. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;

  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      username: schema.users.username,
      role: schema.users.role,
      active: schema.users.active,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);

  const u = rows[0];
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, username: u.username, role: u.role };
}

export class AuthError extends Error {}

/**
 * Guards a server action. Roles are checked here, on the server, so a client
 * cannot reach data or mutations its role does not allow.
 */
export async function requireUser(...allowed: Role[]): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AuthError('Your session has expired — sign in again.');
  if (allowed.length && !allowed.includes(user.role)) {
    throw new AuthError('Your role does not allow this action.');
  }
  return user;
}
