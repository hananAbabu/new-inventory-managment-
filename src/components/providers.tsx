'use client';

import type { ReactNode } from 'react';
import { ConfirmProvider } from './modal';
import { StoreProvider } from './store';
import { ToastProvider } from './toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <StoreProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </StoreProvider>
    </ToastProvider>
  );
}
