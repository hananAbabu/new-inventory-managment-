'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/components/store';

export default function Home() {
  const { me } = useStore();
  const router = useRouter();

  useEffect(() => {
    router.replace(me ? '/dashboard' : '/login');
  }, [me, router]);

  return <div className="boot">Loading workspace…</div>;
}
