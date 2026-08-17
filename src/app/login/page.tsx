'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { fetchPublicSettings } from '@/app/actions/session';
import { Icon } from '@/components/icon';
import { useAuth } from '@/components/store';
import { useToast } from '@/components/toast';
import { lowStock } from '@/lib/selectors';

const DEMO_ACCOUNTS = [
  { label: 'Admin / Owner', username: 'admin', password: 'admin123' },
  { label: 'Storekeeper', username: 'keeper', password: 'keeper123' },
  { label: 'Cashier', username: 'cashier', password: 'cashier123' },
];

export default function LoginPage() {
  const { status, login } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [shopName, setShopName] = useState('Inventory System');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchPublicSettings()
      .then((s) => setShopName(s.shopName))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (status === 'ready') router.replace('/dashboard');
  }, [status, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await login(username.trim(), password);
      if (!result.ok) {
        setError(result.error ?? 'Could not sign in.');
        return;
      }
      const db = result.db!;
      const user = db.users.find((u) => u.username === username.trim().toLowerCase());
      if (user) {
        toast(`Signed in as ${user.name} (${user.role})`);
        const low = lowStock(db);
        if (low.length && (user.role === 'admin' || user.role === 'storekeeper')) {
          setTimeout(
            () =>
              toast(
                `${low.length} product${low.length > 1 ? 's are' : ' is'} at or below minimum stock`,
                'warning',
              ),
            500,
          );
        }
      }
      router.replace('/dashboard');
    } catch {
      setError('Could not reach the server. Is the database running?');
    } finally {
      setBusy(false);
    }
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
          alt="Store"
        />
        <div className="veil" />
        <div className="login-brand">
          <div className="brand-mark">
            <Icon name="bag" />
          </div>
          {shopName}
        </div>
        <div className="login-copy">
          <h2>Run your shop from one counter.</h2>
          <p>
            Role-based dashboards for owners, storekeepers and cashiers — live inventory tracking, a
            fast POS, purchasing, expenses and profit reports.
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
              disabled={busy}
            >
              <Icon name="lock" /> {busy ? 'Signing in…' : 'Sign in securely'}
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
            Passwords are hashed and verified on the server.
          </div>
        </div>
      </div>
    </div>
  );
}
