'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';

export type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  size?: ModalSize;
  children: ReactNode;
}

/** Overlay + panel. Children supply their own <ModalBody> / <ModalFooter>. */
export function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="ovl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${size === 'md' ? '' : size}`} role="dialog" aria-modal="true">
        <div className="m-h">
          <h3>{title}</h3>
          <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalBody({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="m-b" style={style}>
      {children}
    </div>
  );
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="m-f">{children}</div>;
}

/* ---------------- confirm dialog ---------------- */

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirm?: string;
  danger?: boolean;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    setOpts(null);
    const r = resolver.current;
    resolver.current = null;
    r?.(v);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => settle(false)} title={opts?.title ?? ''} size="sm">
        <ModalBody>
          <p style={{ fontSize: '13.5px', color: '#414d46' }}>{opts?.message}</p>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${opts?.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => settle(true)}
          >
            {opts?.confirm || 'Confirm'}
          </button>
        </ModalFooter>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
