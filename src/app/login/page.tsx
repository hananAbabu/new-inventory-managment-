'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { lowStock } from '@/lib/selectors';

const DEMO_ACCOUNTS = [
  { label: 'Admin / Owner', username: 'admin', password: 'admin123' },
  { label: 'Shopkeeper', username: 'keeper', password: 'keeper123' },
  { label: 'Cashier', username: 'cashier', password: 'cashier123' },
];

export default function LoginPage() {
  const { db, me, login } = useStore();
  const toast = useToast();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (me) router.replace('/dashboard');
  }, [me, router]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = login(username.trim(), password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const user = db.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase())!;
    toast(`Signed in as ${user.name} (${user.role})`);
    const low = lowStock(db);
    if (low.length && (user.role === 'admin' || user.role === 'shopkeeper')) {
      setTimeout(
        () =>
          toast(
            `${low.length} product${low.length > 1 ? 's are' : ' is'} at or below minimum stock`,
            'warning',
          ),
        500,
      );
    }
    router.replace('/dashboard');
  }

  function fillDemo(u: string, p: string) {
    setUsername(u);
    setPassword(p);
    setError('');
  }

  return (
    <div className="login">
      <div className="login-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://image.qwenlm.ai/public_source/d340f4da-9f9c-4b62-a978-a4eadc780fe7/173acdfe7-f6c2-4892-a018-a4eadc780fe7.png"
          alt="Merch shop"
        />
        <div className="veil" />
        <div className="login-brand">
          <div className="brand-mark">
            <Icon name="bag" />
          </div>
          {db.settings.shopName}
        </div>
        <div className="login-copy">
          <h2>Run your merch shop from one counter.</h2>
          <p>
            Role-based dashboards for owners, shopkeepers and cashiers — live inventory tracking, a
            fast POS, purchasing and profit reports.
          </p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <h1>Welcome back</h1>
          <div className="sub">Sign in to your workspace to continue.</div>

          {error ? <div className="login-err">{error}</div> : null}

          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="li-user">Username</label>
              <input
                className="input"
                id="li-user"
                autoComplete="username"
                placeholder="e.g. admin"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="li-pass">Password</label>
              <input
                className="input"
                id="li-pass"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
              type="submit"
            >
              <Icon name="lock" /> Sign in securely
            </button>
          </form>

          <div className="demo-box">
            <b>Demo accounts — click to fill</b>
            <div className="demo-chips">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.username}
                  type="button"
                  className="demo-chip"
                  onClick={() => fillDemo(a.username, a.password)}
                >
                  {a.label}
                  <span>
                    {a.username} · {a.password}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: '16px',
              fontSize: '11.5px',
              color: 'var(--muted)',
              textAlign: 'center',
            }}
          >
            Demo build — all data is stored locally in your browser.
          </div>
        </div>
      </div>
    </div>
  );
}
