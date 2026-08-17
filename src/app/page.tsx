'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/store';

export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    router.replace(status === 'ready' ? '/dashboard' : '/login');
  }, [status, router]);

  return <div className="boot">Loading workspace…</div>;
}
