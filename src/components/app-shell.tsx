'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icon';
import { useStore } from './store';
import { can, navFor, pageFor } from '@/lib/navigation';
import { lowStock } from '@/lib/selectors';
import { formatQty } from '@/lib/units';
import { initials } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const { db, me, logout } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    if (!me) router.replace('/login');
  }, [me, router]);

  useEffect(() => {
    setSideOpen(false);
  }, [pathname]);

  if (!me) return <div className="boot">Redirecting to sign-in…</div>;

  const page = pageFor(pathname);
  const low = lowStock(db);
  const showBell = me.role === 'admin' || me.role === 'storekeeper';
  const allowed = can(me.role, pathname);
  const title = page?.title ?? 'Dashboard';

  return (
    <div className="layout">
      <aside className={`sidebar ${sideOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Icon name="bag" />
          </div>
          <div>
            <div className="brand-name">{db.settings.shopName}</div>
            <div className="brand-sub">Inventory Suite</div>
          </div>
        </div>

        <nav className="side-nav">
          {navFor(me.role).map((g) => (
            <div className="nav-g" key={g.group}>
              <div>{g.group}</div>
              {g.items.map((it) => (
                <Link
                  key={it.path}
                  href={it.path}
                  className={`nav-item ${pathname === it.path ? 'on' : ''}`}
                >
                  <Icon name={it.icon} />
                  <span>{it.label}</span>
                  {it.path === '/low-stock' && low.length ? (
                    <span className="nav-pill">{low.length}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <div className="side-user">
            <div className="avatar">{initials(me.name)}</div>
            <div style={{ minWidth: 0 }}>
              <b>{me.name}</b>
              <span>{me.role}</span>
            </div>
            <button
              className="icon-btn sm"
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                borderColor: 'rgba(255,255,255,.15)',
                color: '#9fb8ab',
              }}
              title="Sign out"
              onClick={() => {
                logout();
                router.replace('/login');
              }}
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <div className={`scrim ${sideOpen ? 'on' : ''}`} onClick={() => setSideOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn hamb" onClick={() => setSideOpen(true)} aria-label="Open menu">
            <Icon name="dashboard" />
          </button>
          <div>
            <div className="crumb">
              {db.settings.shopName} / {title}
            </div>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            {showBell ? <NotificationBell /> : null}
            <div
              className="side-user"
              style={{ background: '#f2f6f3', borderRadius: '12px', padding: '6px 10px' }}
            >
              <div
                className="avatar"
                style={{ width: 30, height: 30, flexBasis: '30px', fontSize: '11px' }}
              >
                {initials(me.name)}
              </div>
              <div>
                <b style={{ fontSize: '12.5px', color: 'var(--ink)' }}>{me.name}</b>
                <span
                  style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'capitalize' }}
                >
                  {me.role}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="content">{allowed ? children : <AccessDenied />}</div>
      </div>
    </div>
  );
}

function NotificationBell() {
  const { db } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const low = lowStock(db);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="icon-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Low-stock alerts"
      >
        <Icon name="bell" />
        {low.length ? <span className="dot">{low.length}</span> : null}
      </button>

      {open ? (
        <div className="notif-pop">
          <h4>Low-stock alerts</h4>
          {low.length ? (
            low.map((p) => (
              <button
                key={p.id}
                className="notif-item"
                onClick={() => {
                  setOpen(false);
                  router.push('/low-stock');
                }}
              >
                <span className="badge b-amber">{formatQty(p.qty, p.unit)} left</span>
                <div>
                  <b>{p.name}</b>
                  <div style={{ color: 'var(--muted)', fontSize: '11.5px' }}>
                    {p.sku} · min {formatQty(p.minStock, p.unit)}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="empty" style={{ padding: '24px' }}>
              <b>All stocked up</b>No products below minimum level.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AccessDenied() {
  const { me } = useStore();
  return (
    <div className="card deny">
      <div className="e-ic">
        <Icon name="lock" />
      </div>
      <h3 style={{ fontSize: '18px', marginBottom: '6px' }}>Access restricted</h3>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '18px' }}>
        Your role (<b style={{ textTransform: 'capitalize' }}>{me?.role ?? '—'}</b>) does not have
        permission to view this area. Contact the owner if you believe this is a mistake.
      </p>
      <Link className="btn btn-primary" href="/dashboard">
        <Icon name="dashboard" /> Back to dashboard
      </Link>
    </div>
  );
}
