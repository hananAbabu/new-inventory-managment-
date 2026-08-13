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
import { useToast } from './toast';
import { migrate, type LegacyDb } from '@/lib/migrate';
import { seed } from '@/lib/seed';
import { money as fmtMoney } from '@/lib/selectors';
import type { Db, Session, User } from '@/lib/types';
import { uid } from '@/lib/utils';

const LS_DB = 'msims_db_v1';
const LS_SES = 'msims_ses_v1';

export type AuditFn = (group: string, action: string, detail: string) => void;
/** A mutation recipe: mutate the draft, optionally logging to the audit trail. */
export type Recipe = (draft: Db, audit: AuditFn) => void;

interface StoreValue {
  db: Db;
  me: User | null;
  session: Session | null;
  update: (recipe: Recipe) => void;
  login: (username: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  resetDemoData: () => void;
  money: (n: number | undefined | null) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(LS_DB);
    if (raw) {
      const d = JSON.parse(raw) as LegacyDb;
      if (d && d.users && d.settings && d.products) {
        const upgraded = migrate(d);
        localStorage.setItem(LS_DB, JSON.stringify(upgraded));
        return upgraded;
      }
    }
  } catch {
    /* corrupt payload — fall through to a fresh seed */
  }
  const fresh = seed();
  localStorage.setItem(LS_DB, JSON.stringify(fresh));
  return fresh;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(LS_SES);
    if (raw) return JSON.parse(raw) as Session;
  } catch {
    /* ignore */
  }
  return null;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [db, setDb] = useState<Db | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // localStorage is browser-only, so hydrate after mount.
  useEffect(() => {
    setDb(loadDb());
    setSession(loadSession());
  }, []);

  // Slip photos can push the workspace past the ~5 MB localStorage ceiling. The
  // write must not fail silently: the state would look saved and be gone on reload.
  const persist = useCallback(
    (next: Db) => {
      try {
        localStorage.setItem(LS_DB, JSON.stringify(next));
      } catch {
        toast(
          'Browser storage is full — this change is not saved. Remove some transfer slip photos and try again.',
          'error',
        );
      }
    },
    [toast],
  );

  const persistSession = useCallback((next: Session | null) => {
    if (next) localStorage.setItem(LS_SES, JSON.stringify(next));
    else localStorage.removeItem(LS_SES);
  }, []);

  const me = useMemo(
    () => (db && session ? db.users.find((u) => u.id === session.userId) ?? null : null),
    [db, session],
  );

  const update = useCallback(
    (recipe: Recipe) => {
      setDb((current) => {
        if (!current) return current;
        const draft: Db = structuredClone(current);
        const audit: AuditFn = (group, action, detail) => {
          draft.audit.push({
            id: uid(draft.audit),
            date: Date.now(),
            userId: session ? session.userId : null,
            group,
            action,
            detail,
          });
        };
        recipe(draft, audit);
        persist(draft);
        return draft;
      });
    },
    [persist, session],
  );

  const login = useCallback<StoreValue['login']>(
    (username, password) => {
      if (!db) return { ok: false, error: 'Workspace is still loading — try again.' };
      const user = db.users.find(
        (x) => x.username.toLowerCase() === username.toLowerCase() && x.password === password,
      );
      if (!user) return { ok: false, error: 'Invalid username or password.' };
      if (!user.active)
        return { ok: false, error: 'This account has been deactivated. Contact the owner.' };
      const next = { userId: user.id };
      setSession(next);
      persistSession(next);
      return { ok: true };
    },
    [db, persistSession],
  );

  const logout = useCallback(() => {
    setSession(null);
    persistSession(null);
  }, [persistSession]);

  const resetDemoData = useCallback(() => {
    const fresh = seed();
    persist(fresh);
    setDb(fresh);
  }, [persist]);

  // A deactivated or deleted account must not keep an open session.
  useEffect(() => {
    if (db && session && !me) {
      setSession(null);
      persistSession(null);
    }
    if (me && !me.active) {
      setSession(null);
      persistSession(null);
    }
  }, [db, session, me, persistSession]);

  const value = useMemo<StoreValue | null>(() => {
    if (!db) return null;
    return {
      db,
      me,
      session,
      update,
      login,
      logout,
      resetDemoData,
      money: (n) => fmtMoney(db.settings.currency, n),
    };
  }, [db, me, session, update, login, logout, resetDemoData]);

  if (!value) return <div className="boot">Loading workspace…</div>;

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
