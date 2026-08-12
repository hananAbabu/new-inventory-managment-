'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './icon';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
  visible: boolean;
}

const ICON_FOR: Record<ToastType, IconName> = {
  success: 'check',
  error: 'alert',
  warning: 'alert',
  info: 'bell',
};

type ToastFn = (msg: string, type?: ToastType) => void;

const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const toast = useCallback<ToastFn>((msg, type = 'success') => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, msg, type, visible: false }]);

    // Next frame: flip to the visible class so the CSS transition runs.
    requestAnimationFrame(() =>
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, visible: true } : t))),
    );

    timers.current.push(
      setTimeout(() => {
        setItems((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
        timers.current.push(
          setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 300),
        );
      }, 4200),
    );
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div id="toast-root">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type} ${t.visible ? 'in' : ''}`}>
            <Icon name={ICON_FOR[t.type]} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
