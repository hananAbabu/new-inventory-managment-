'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Chart, PALETTE } from '@/components/chart';
import { Icon } from '@/components/icon';
import { ReceiptModal } from '@/components/receipt';
import { useStore } from '@/components/store';
import { Badge, EmptyState, Kpi } from '@/components/ui';
import {
  catName,
  inventoryValue,
  lowStock,
  retailValue,
  stockState,
  supName,
  txBadge,
  userName,
} from '@/lib/selectors';
import type { Db, Sale } from '@/lib/types';
import { formatQty, formatQtyNumber } from '@/lib/units';
import { DAY, fd, startOfDay, startOfMonth } from '@/lib/utils';

export default function DashboardPage() {
  const { me } = useStore();
  if (!me) return null;
  if (me.role === 'cashier') return <CashierDashboard />;
  if (me.role === 'storekeeper') return <KeeperDashboard />;
  return <AdminDashboard />;
}

function last14Days(): number[] {
  const today = startOfDay(Date.now());
  return [...Array(14)].map((_, i) => today - (13 - i) * DAY);
}

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

function revenueByCategory(db: Db): { labels: string[]; values: number[] } {
  const map: Record<number, number> = {};
  db.sales.forEach((s) =>
    s.items.forEach((i) => {
      const p = db.products.find((x) => x.id === i.productId);
      if (!p) return;
      map[p.categoryId] = (map[p.categoryId] || 0) + i.price * i.qty;
    }),
  );
  return {
    labels: Object.keys(map).map((id) => catName(db, Number(id))),
    values: Object.values(map),
  };
}

/* ---------------- admin ---------------- */

function AdminDashboard() {
  const { db, money } = useStore();

  const t0 = startOfDay(Date.now());
  const m0 = startOfMonth();
  const sToday = db.sales.filter((s) => s.createdAt >= t0);
  const sMonth = db.sales.filter((s) => s.createdAt >= m0);
  const low = lowStock(db);
  const purchTotal = db.purchases
    .filter((p) => p.status === 'received')
    .reduce((a, p) => a + p.total, 0);
  const profit = sMonth.reduce(
    (a, s) => a + s.items.reduce((x, i) => x + (i.price - i.cost) * i.qty, 0) - s.discount,
    0,
  );

  const recent = useMemo(
    () =>
      [
        ...db.sales.map((s) => ({
          t: s.createdAt,
          ref: s.ref,
          kind: 'Sale' as const,
          who: userName(db, s.cashierId),
          amt: s.total,
        })),
        ...db.purchases.map((p) => ({
          t: p.createdAt,
          ref: p.ref,
          kind: 'Purchase' as const,
          who: supName(db, p.supplierId),
          amt: p.total,
        })),
      ]
        .sort((a, b) => b.t - a.t)
        .slice(0, 8),
    [db],
  );

  const days = last14Days();
  const perDay = days.map((d) =>
    db.sales.filter((s) => s.createdAt >= d && s.createdAt < d + DAY).reduce((a, s) => a + s.total, 0),
  );
  const byCat = revenueByCategory(db);
  const currency = db.settings.currency;

  return (
    <>
      <div className="kpis">
        <Kpi
          label="Total products"
          value={db.products.length}
          icon="tag"
          tone="green"
          sub={`${db.categories.length} categories`}
        />
        <Kpi label="Inventory value" value={money(inventoryValue(db))} icon="cube" tone="blue" sub="at cost price" />
        <Kpi
          label="Low-stock products"
          value={low.length}
          icon="alert"
          tone={low.length ? 'amber' : 'green'}
          sub={low.length ? 'needs reordering' : 'all healthy'}
        />
        <Kpi
          label="Today's sales"
          value={money(sToday.reduce((a, s) => a + s.total, 0))}
          icon="pos"
          tone="green"
          sub={`${sToday.length} transactions`}
        />
        <Kpi
          label="Monthly sales"
          value={money(sMonth.reduce((a, s) => a + s.total, 0))}
          icon="chart"
          tone="violet"
          sub={`${sMonth.length} transactions`}
        />
        <Kpi
          label="Total purchases"
          value={money(purchTotal)}
          icon="truck"
          tone="amber"
          sub={`${db.purchases.length} orders`}
        />
        <Kpi
          label="Est. profit (month)"
          value={money(profit)}
          icon="shield"
          tone="green"
          sub="gross margin after discounts"
        />
        <Kpi
          label="Retail value"
          value={money(retailValue(db))}
          icon="inbox"
          tone="blue"
          sub="if all stock sells"
        />
      </div>

      <div className="grid two-col" style={{ marginTop: '16px' }}>
        <div className="card">
          <div className="card-h">
            <h3>Sales — last 14 days</h3>
          </div>
          <div className="card-b">
            <Chart
              config={{
                type: 'bar',
                data: {
                  labels: days.map(dayLabel),
                  datasets: [
                    {
                      label: 'Revenue',
                      data: perDay,
                      backgroundColor: '#0e7c5b',
                      borderRadius: 6,
                      maxBarThickness: 26,
                    },
                  ],
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { ticks: { callback: (v) => currency + v } } },
                },
              }}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Revenue by category</h3>
          </div>
          <div className="card-b">
            <Chart
              config={{
                type: 'doughnut',
                data: {
                  labels: byCat.labels,
                  datasets: [
                    {
                      data: byCat.values,
                      backgroundColor: PALETTE,
                      borderWidth: 2,
                      borderColor: '#fff',
                    },
                  ],
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-h">
          <h3>Recent transactions</h3>
          <Link className="btn btn-ghost" style={{ marginLeft: 'auto' }} href="/sales">
            View all
          </Link>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Type</th>
                <th>Party</th>
                <th>Date</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.kind + r.ref}>
                  <td>
                    <b>{r.ref}</b>
                  </td>
                  <td>
                    <Badge tone={r.kind === 'Sale' ? 'b-blue' : 'b-amber'}>{r.kind}</Badge>
                  </td>
                  <td>{r.who}</td>
                  <td>{fd(r.t)}</td>
                  <td className="num">
                    <b>{money(r.amt)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------------- storekeeper ---------------- */

function KeeperDashboard() {
  const { db } = useStore();
  const low = lowStock(db);
  // Quantities span pieces, kilograms and litres, so this counts receipts, not a mixed-unit total.
  const recv30 = db.invTx
    .filter((t) => t.type === 'purchase' || t.type === 'received')
    .filter((t) => t.date >= Date.now() - 30 * DAY).length;
  const moves = [...db.invTx].sort((a, b) => b.date - a.date).slice(0, 8);

  // Counted in SKUs rather than valued: stock valuation is owner information,
  // and quantities across pieces, kilograms and litres cannot be summed anyway.
  const catMap: Record<number, number> = {};
  db.products.forEach((p) => {
    catMap[p.categoryId] = (catMap[p.categoryId] || 0) + 1;
  });

  return (
    <>
      <div className="kpis">
        <Kpi
          label="Total products"
          value={db.products.length}
          icon="tag"
          tone="green"
          sub={`${db.categories.length} categories`}
        />
        <Kpi
          label="Out of stock"
          value={db.products.filter((p) => p.qty <= 0).length}
          icon="cube"
          tone="blue"
          sub="SKUs at zero"
        />
        <Kpi
          label="Pending orders"
          value={db.purchases.filter((p) => p.status === 'ordered').length}
          icon="inbox"
          tone="violet"
          sub="awaiting delivery"
        />
        <Kpi label="Stock receipts (30d)" value={recv30} icon="truck" tone="green" />
        <Kpi
          label="Low-stock products"
          value={low.length}
          icon="alert"
          tone={low.length ? 'amber' : 'green'}
          sub={low.length ? 'action needed' : 'all healthy'}
        />
      </div>

      <div className="grid two-col" style={{ marginTop: '16px' }}>
        <div className="card">
          <div className="card-h">
            <h3>Low stock — reorder list</h3>
            <Link className="btn btn-soft" style={{ marginLeft: 'auto' }} href="/low-stock">
              Open monitor
            </Link>
          </div>
          {low.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">On hand</th>
                    <th className="num">Min</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {low.slice(0, 6).map((p) => {
                    const st = stockState(p);
                    return (
                      <tr key={p.id}>
                        <td>
                          <b>{p.name}</b>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.sku}</div>
                        </td>
                        <td className="num">{formatQty(p.qty, p.unit)}</td>
                        <td className="num">{formatQtyNumber(p.minStock)}</td>
                        <td>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="check"
              title="Everything is stocked"
              sub="No products below minimum level."
            />
          )}
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Products by category</h3>
          </div>
          <div className="card-b">
            <Chart
              config={{
                type: 'bar',
                data: {
                  labels: Object.keys(catMap).map((id) => catName(db, Number(id))),
                  datasets: [
                    {
                      label: 'SKUs',
                      data: Object.values(catMap),
                      backgroundColor: '#2f6fd0',
                      borderRadius: 6,
                      maxBarThickness: 30,
                    },
                  ],
                },
                options: {
                  indexAxis: 'y',
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { x: { ticks: { precision: 0 } } },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-h">
          <h3>Latest stock movements</h3>
          <Link className="btn btn-ghost" style={{ marginLeft: 'auto' }} href="/inventory">
            Inventory log
          </Link>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th className="num">Qty</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((t) => {
                const b = txBadge(t.type);
                return (
                  <tr key={t.id}>
                    <td>{fd(t.date)}</td>
                    <td>
                      <b>{t.name}</b>
                    </td>
                    <td>
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </td>
                    <td
                      className="num"
                      style={{ fontWeight: 800, color: t.qty < 0 ? 'var(--danger)' : 'var(--brand)' }}
                    >
                      {t.qty > 0 ? '+' : ''}
                      {formatQty(t.qty, t.unit)}
                    </td>
                    <td>{userName(db, t.userId)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------------- cashier ---------------- */

function CashierDashboard() {
  const { db, me, money } = useStore();
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const t0 = startOfDay(Date.now());
  const m0 = startOfMonth();
  const mine = db.sales.filter((s) => s.cashierId === me!.id);
  const today = mine.filter((s) => s.createdAt >= t0);
  const month = mine.filter((s) => s.createdAt >= m0);
  const recent = [...mine].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <>
      <div
        className="card"
        style={{ background: 'linear-gradient(120deg,#0e7c5b,#0a5c44)', border: 0, color: '#eafff4' }}
      >
        <div
          className="card-b"
          style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <div style={{ flex: 1, minWidth: '220px' }}>
            <h3 style={{ fontSize: '19px', color: '#fff' }}>
              Hi {me!.name.split(' ')[0]} — register ready.
            </h3>
            <div style={{ color: '#bfe6d4', fontSize: '13px', marginTop: '4px' }}>
              {today.length} sale{today.length === 1 ? '' : 's'} today ·{' '}
              {money(today.reduce((a, s) => a + s.total, 0))} taken so far.
            </div>
          </div>
          <Link
            className="btn"
            style={{ background: '#fff', color: 'var(--brand-2)', padding: '11px 18px' }}
            href="/pos"
          >
            <Icon name="pos" /> Open register / new sale
          </Link>
        </div>
      </div>

      <div className="kpis" style={{ marginTop: '16px' }}>
        <Kpi
          label="Sales today"
          value={today.length}
          icon="pos"
          tone="green"
          sub={money(today.reduce((a, s) => a + s.total, 0))}
        />
        <Kpi
          label="Average sale (today)"
          value={money(today.length ? today.reduce((a, s) => a + s.total, 0) / today.length : 0)}
          icon="chart"
          tone="blue"
        />
        <Kpi
          label="Sales this month"
          value={month.length}
          icon="receipt"
          tone="violet"
          sub={money(month.reduce((a, s) => a + s.total, 0))}
        />
        <Kpi
          label="Discounts given (month)"
          value={money(month.reduce((a, s) => a + s.discount, 0))}
          icon="tag"
          tone="amber"
        />
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-h">
          <h3>My recent transactions</h3>
          <Link className="btn btn-ghost" style={{ marginLeft: 'auto' }} href="/my-sales">
            All my sales
          </Link>
        </div>
        {mine.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Method</th>
                  <th className="num">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.ref}</b>
                    </td>
                    <td>{fd(s.createdAt)}</td>
                    <td>{s.items.reduce((a, i) => a + i.qty, 0)}</td>
                    <td>
                      <Badge tone="b-gray">{s.payMethod}</Badge>
                    </td>
                    <td className="num">
                      <b>{money(s.total)}</b>
                    </td>
                    <td>
                      <button
                        className="icon-btn sm"
                        title="View receipt"
                        onClick={() => setReceipt(s)}
                      >
                        <Icon name="eye" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="receipt"
            title="No sales yet"
            sub="Complete your first sale from the register."
          />
        )}
      </div>

      <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
