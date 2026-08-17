'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchWorkspace, signIn, signOut } from '@/app/actions/session';
import type { ActionResult } from '@/app/actions/shared';
import { money as fmtMoney } from '@/lib/selectors';
import type { Db, User } from '@/lib/types';
import { useToast } from './toast';

type Status = 'loading' | 'anon' | 'ready';

interface StoreValue {
  status: Status;
  db: Db | null;
  me: User | null;
  /** Runs a server action, swapping in the workspace it returns. */
  run: (fn: () => Promise<ActionResult>) => Promise<boolean>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string; db?: Db }>;
  logout: () => Promise<void>;
  money: (n: number | undefined | null) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [db, setDb] = useState<Db | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWorkspace()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setDb(res.db);
          setUserId(res.userId);
          setStatus('ready');
        } else {
          setStatus('anon');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('anon');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const me = useMemo(
    () => (db && userId ? db.users.find((u) => u.id === userId) ?? null : null),
    [db, userId],
  );

  const run = useCallback<StoreValue['run']>(
    async (fn) => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast(res.error, 'error');
          return false;
        }
        setDb(res.db);
        return true;
      } catch (err) {
        console.error(err);
        toast('Could not reach the server — check your connection.', 'error');
        return false;
      }
    },
    [toast],
  );

  const login = useCallback<StoreValue['login']>(async (username, password) => {
    const res = await signIn(username, password);
    if (!res.ok) return { ok: false, error: res.error };
    setDb(res.db);
    setUserId(res.userId);
    setStatus('ready');
    return { ok: true, db: res.db };
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setDb(null);
    setUserId(null);
    setStatus('anon');
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      status,
      db,
      me,
      run,
      login,
      logout,
      money: (n) => fmtMoney(db?.settings.currency ?? '$', n),
    }),
    [status, db, me, run, login, logout],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Auth-aware access, for the shell and the sign-in screen. */
export function useAuth(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAuth must be used inside <StoreProvider>');
  return ctx;
}

/**
 * Workspace access for authenticated pages. These only ever mount behind the
 * shell's guard, so the workspace and the signed-in user are present.
 */
export function useStore(): {
  db: Db;
  me: User;
  run: StoreValue['run'];
  money: StoreValue['money'];
} {
  const ctx = useAuth();
  if (!ctx.db || !ctx.me) {
    throw new Error('useStore used outside an authenticated route');
  }
  return { db: ctx.db, me: ctx.me, run: ctx.run, money: ctx.money };
}
