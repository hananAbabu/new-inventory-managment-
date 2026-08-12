'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import type { BadgeTone } from '@/lib/selectors';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'gray';

export function Kpi({
  label,
  value,
  icon,
  tone,
  sub,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  tone: Tone;
  sub?: ReactNode;
}) {
  return (
    <div className="kpi">
      <div className={`kpi-ic t-${tone}`}>
        <Icon name={icon} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="kpi-v">{value}</div>
        <div className="kpi-l">{label}</div>
        {sub ? <div className="kpi-s">{sub}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: IconName;
  title: string;
  sub?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="e-ic">
        <Icon name={icon} />
      </div>
      <b>{title}</b>
      {sub}
    </div>
  );
}

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function StatStrip({
  stats,
  children,
  bordered,
}: {
  stats: { label: string; value: ReactNode; accent?: boolean }[];
  children?: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div className="stat-strip" style={bordered ? { borderBottom: '1px solid var(--line)' } : undefined}>
      {stats.map((s) => (
        <div key={s.label}>
          <span>{s.label}</span>
          <b style={s.accent ? { color: 'var(--brand)' } : undefined}>{s.value}</b>
        </div>
      ))}
      {children}
    </div>
  );
}

/* ---------------- pagination ---------------- */

export function usePaged<T>(list: T[], perPage: number) {
  const [rawPage, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const page = Math.min(Math.max(rawPage, 1), pages);
  const rows = useMemo(
    () => list.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    [list, page, perPage],
  );
  return { rows, page, pages, setPage, total: list.length, perPage };
}

export function Pager({
  total,
  page,
  pages,
  onPage,
}: {
  total: number;
  page: number;
  pages: number;
  onPage: (n: number) => void;
}) {
  if (pages <= 1)
    return (
      <div className="pager" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {total} record{total === 1 ? '' : 's'}
        </span>
      </div>
    );

  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums: number[] = [];
  for (let i = start; i <= Math.min(pages, start + 4); i++) nums.push(i);

  return (
    <div className="pager">
      <span style={{ fontSize: '12px', color: 'var(--muted)', marginRight: 'auto' }}>
        {total} records · page {page}/{pages}
      </span>
      <button className="pg-btn" disabled={page === 1} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      {nums.map((n) => (
        <button key={n} className={`pg-btn ${n === page ? 'on' : ''}`} onClick={() => onPage(n)}>
          {n}
        </button>
      ))}
      <button className="pg-btn" disabled={page === pages} onClick={() => onPage(page + 1)}>
        ›
      </button>
    </div>
  );
}

/* ---------------- sorting ---------------- */

export function useSort<F extends string>(initial: F) {
  const [sort, setSort] = useState<F>(initial);
  const [dir, setDir] = useState(1);
  const toggle = (f: F) => {
    if (f === sort) setDir((d) => -d);
    else {
      setSort(f);
      setDir(1);
    }
  };
  return { sort, dir, toggle };
}

export function SortTh<F extends string>({
  field,
  label,
  sort,
  dir,
  onSort,
  className,
}: {
  field: F;
  label: string;
  sort: F;
  dir: number;
  onSort: (f: F) => void;
  className?: string;
}) {
  return (
    <th className={`th-sort ${className ?? ''}`} onClick={() => onSort(field)}>
      {label} {sort === field ? (dir > 0 ? '↑' : '↓') : ''}
    </th>
  );
}

/* ---------------- tabs ---------------- */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`tab ${active === t.key ? 'on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
