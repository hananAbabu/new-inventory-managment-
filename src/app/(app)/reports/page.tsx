'use client';

import { useMemo, useState } from 'react';
import { Chart, PALETTE } from '@/components/chart';
import { Icon } from '@/components/icon';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { Badge, EmptyState, StatStrip } from '@/components/ui';
import { exportSalesCsv } from '@/lib/export';
import { lowStock, stockState, supName, userName } from '@/lib/selectors';
import type { Role } from '@/lib/types';
import { DAY, fd, fdS, startOfDay } from '@/lib/utils';

type ReportTab =
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'lowstock'
  | 'performance'
  | 'cashiers'
  | 'profit';

const REPORT_TABS: { key: ReportTab; label: string; roles: Role[] }[] = [
  { key: 'sales', label: 'Sales', roles: ['admin', 'shopkeeper'] },
  { key: 'purchases', label: 'Purchases', roles: ['admin'] },
  { key: 'inventory', label: 'Inventory', roles: ['admin', 'shopkeeper'] },
  { key: 'lowstock', label: 'Low Stock', roles: ['admin', 'shopkeeper'] },
  { key: 'performance', label: 'Product Performance', roles: ['admin', 'shopkeeper'] },
  { key: 'cashiers', label: 'Cashier Sales', roles: ['admin'] },
  { key: 'profit', label: 'Profit', roles: ['admin'] },
];

const RANGED_TABS: ReportTab[] = ['sales', 'performance', 'cashiers', 'profit'];
const RANGES = [0, 7, 30, -1];

function rangeLabel(r: number): string {
  return r === 0 ? 'Today' : r === -1 ? 'All time' : `${r} days`;
}

function rangeFrom(r: number): number {
  return r === 0 ? startOfDay(Date.now()) : r === -1 ? 0 : Date.now() - r * DAY;
}

function last14Days(): number[] {
  const today = startOfDay(Date.now());
  return [...Array(14)].map((_, i) => today - (13 - i) * DAY);
}

export default function ReportsPage() {
  const { db, me } = useStore();
  const toast = useToast();

  const tabs = REPORT_TABS.filter((t) => t.roles.includes(me!.role));
  const [tab, setTab] = useState<ReportTab>(tabs[0].key);
  const [range, setRange] = useState(30);

  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;
  const from = rangeFrom(range);

  return (
    <div className="card">
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${active === t.key ? 'on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar" style={{ borderTop: 0 }}>
        {RANGED_TABS.includes(active)
          ? RANGES.map((r) => (
              <button
                key={r}
                className={`chip ${range === r ? 'on' : ''}`}
                onClick={() => setRange(r)}
              >
                {rangeLabel(r)}
              </button>
            ))
          : null}
        {active === 'sales' ? (
          <button
            className="btn btn-ghost"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              exportSalesCsv(
                db,
                [...db.sales].sort((a, b) => b.createdAt - a.createdAt).filter((s) => s.createdAt >= from),
              );
              toast('Exported sales-report.csv');
            }}
          >
            <Icon name="download" /> CSV
          </button>
        ) : null}
      </div>

      <div className="card-b" style={{ padding: 0 }}>
        {active === 'sales' ? <SalesReport from={from} /> : null}
        {active === 'purchases' ? <PurchasesReport /> : null}
        {active === 'inventory' ? <InventoryReport /> : null}
        {active === 'lowstock' ? <LowStockReport /> : null}
        {active === 'performance' ? <PerformanceReport from={from} /> : null}
        {active === 'cashiers' ? <CashiersReport from={from} /> : null}
        {active === 'profit' ? <ProfitReport from={from} /> : null}
      </div>
    </div>
  );
}

function SalesReport({ from }: { from: number }) {
  const { db, money } = useStore();
  const list = db.sales.filter((s) => s.createdAt >= from).sort((a, b) => b.createdAt - a.createdAt);
  const days = last14Days();
  const currency = db.settings.currency;

  return (
    <>
      <StatStrip
        stats={[
          { label: 'Transactions', value: list.length },
          { label: 'Revenue', value: money(list.reduce((a, s) => a + s.total, 0)) },
          {
            label: 'Items sold',
            value: list.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0),
          },
          { label: 'Discounts', value: money(list.reduce((a, s) => a + s.discount, 0)) },
        ]}
      />

      <div className="card-b">
        <Chart
          height={210}
          config={{
            type: 'line',
            data: {
              labels: days.map(fdS),
              datasets: [
                {
                  label: 'Revenue',
                  data: days.map((d) =>
                    db.sales
                      .filter((s) => s.createdAt >= d && s.createdAt < d + DAY)
                      .reduce((a, s) => a + s.total, 0),
                  ),
                  borderColor: '#0e7c5b',
                  backgroundColor: 'rgba(14,124,91,.12)',
                  fill: true,
                  tension: 0.35,
                  pointRadius: 2,
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

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Date</th>
              <th>Cashier</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.slice(0, 12).map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.ref}</b>
                  </td>
                  <td>{fd(s.createdAt)}</td>
                  <td>{userName(db, s.cashierId)}</td>
                  <td className="num">
                    <b>{money(s.total)}</b>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon="chart" title="No sales in range" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PurchasesReport() {
  const { db, money } = useStore();
  const list = [...db.purchases].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <StatStrip
        stats={[
          { label: 'Orders', value: list.length },
          {
            label: 'Total spend',
            value: money(
              list.filter((p) => p.status === 'received').reduce((a, p) => a + p.total, 0),
            ),
          },
          { label: 'Pending', value: list.filter((p) => p.status === 'ordered').length },
        ]}
      />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Date</th>
              <th>Supplier</th>
              <th className="num">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.ref}</b>
                </td>
                <td>{fd(p.createdAt)}</td>
                <td>{supName(db, p.supplierId)}</td>
                <td className="num">
                  <b>{money(p.total)}</b>
                </td>
                <td>
                  {p.status === 'received' ? (
                    <Badge tone="b-green">Received</Badge>
                  ) : (
                    <Badge tone="b-amber">Ordered</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function InventoryReport() {
  const { db, money } = useStore();
  const list = [...db.products].sort((a, b) => b.qty * b.costPrice - a.qty * a.costPrice);

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th className="num">On hand</th>
            <th className="num">Cost value</th>
            <th className="num">Retail value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => {
            const st = stockState(p);
            return (
              <tr key={p.id}>
                <td>
                  <b>{p.sku}</b>
                </td>
                <td>{p.name}</td>
                <td className="num">{p.qty}</td>
                <td className="num">{money(p.qty * p.costPrice)}</td>
                <td className="num">{money(p.qty * p.sellPrice)}</td>
                <td>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={2}>
              <b>Totals</b>
            </td>
            <td className="num">
              <b>{db.products.reduce((a, p) => a + p.qty, 0)}</b>
            </td>
            <td className="num">
              <b>{money(db.products.reduce((a, p) => a + p.qty * p.costPrice, 0))}</b>
            </td>
            <td className="num">
              <b>{money(db.products.reduce((a, p) => a + p.qty * p.sellPrice, 0))}</b>
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LowStockReport() {
  const { db } = useStore();
  const low = lowStock(db);

  if (!low.length)
    return (
      <EmptyState
        icon="check"
        title="No low-stock products"
        sub="All items are above their minimum levels."
      />
    );

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th className="num">On hand</th>
            <th className="num">Min</th>
            <th className="num">Deficit</th>
            <th>Supplier</th>
          </tr>
        </thead>
        <tbody>
          {low.map((p) => (
            <tr key={p.id}>
              <td>
                <b>{p.sku}</b>
              </td>
              <td>{p.name}</td>
              <td className="num">{p.qty}</td>
              <td className="num">{p.minStock}</td>
              <td className="num" style={{ color: 'var(--danger)' }}>
                <b>{Math.max(0, p.minStock - p.qty)}</b>
              </td>
              <td>{supName(db, p.supplierId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PerformanceReport({ from }: { from: number }) {
  const { db, money } = useStore();
  const currency = db.settings.currency;

  const list = useMemo(() => {
    const map: Record<
      number,
      { name: string; sku: string; units: number; rev: number; profit: number }
    > = {};
    db.sales
      .filter((s) => s.createdAt >= from)
      .forEach((s) =>
        s.items.forEach((i) => {
          const m =
            map[i.productId] ||
            (map[i.productId] = { name: i.name, sku: i.sku, units: 0, rev: 0, profit: 0 });
          m.units += i.qty;
          m.rev += i.price * i.qty;
          m.profit += (i.price - i.cost) * i.qty;
        }),
      );
    return Object.values(map).sort((a, b) => b.rev - a.rev);
  }, [db.sales, from]);

  const top = list.slice(0, 6);

  return (
    <>
      <div className="card-b">
        <Chart
          height={230}
          config={{
            type: 'bar',
            data: {
              labels: top.map((m) => m.sku),
              datasets: [
                {
                  label: 'Revenue',
                  data: top.map((m) => +m.rev.toFixed(2)),
                  backgroundColor: '#0e7c5b',
                  borderRadius: 6,
                  maxBarThickness: 34,
                },
                {
                  label: 'Profit',
                  data: top.map((m) => +m.profit.toFixed(2)),
                  backgroundColor: '#e89b18',
                  borderRadius: 6,
                  maxBarThickness: 34,
                },
              ],
            },
            options: {
              maintainAspectRatio: false,
              scales: { y: { ticks: { callback: (v) => currency + v } } },
            },
          }}
        />
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th className="num">Units sold</th>
              <th className="num">Revenue</th>
              <th className="num">Profit</th>
              <th className="num">Margin</th>
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.slice(0, 12).map((m, i) => (
                <tr key={m.sku}>
                  <td>{i + 1}</td>
                  <td>
                    <b>{m.name}</b>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.sku}</div>
                  </td>
                  <td className="num">{m.units}</td>
                  <td className="num">
                    <b>{money(m.rev)}</b>
                  </td>
                  <td className="num" style={{ color: 'var(--brand)' }}>
                    <b>{money(m.profit)}</b>
                  </td>
                  <td className="num">{m.rev ? Math.round((m.profit / m.rev) * 100) : 0}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon="chart" title="No sales in range" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CashiersReport({ from }: { from: number }) {
  const { db, money } = useStore();
  const currency = db.settings.currency;

  const list = useMemo(() => {
    const map: Record<
      number,
      { name: string; count: number; rev: number; disc: number; items: number }
    > = {};
    db.sales
      .filter((s) => s.createdAt >= from)
      .forEach((s) => {
        const m =
          map[s.cashierId] ||
          (map[s.cashierId] = {
            name: userName(db, s.cashierId),
            count: 0,
            rev: 0,
            disc: 0,
            items: 0,
          });
        m.count++;
        m.rev += s.total;
        m.disc += s.discount;
        m.items += s.items.reduce((a, i) => a + i.qty, 0);
      });
    return Object.values(map).sort((a, b) => b.rev - a.rev);
  }, [db, from]);

  return (
    <>
      <div className="card-b">
        <Chart
          height={200}
          config={{
            type: 'bar',
            data: {
              labels: list.map((m) => m.name),
              datasets: [
                {
                  label: 'Revenue',
                  data: list.map((m) => +m.rev.toFixed(2)),
                  backgroundColor: PALETTE,
                  borderRadius: 6,
                  maxBarThickness: 44,
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

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Cashier</th>
              <th className="num">Transactions</th>
              <th className="num">Items</th>
              <th className="num">Discounts</th>
              <th className="num">Revenue</th>
              <th className="num">Avg sale</th>
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.map((m) => (
                <tr key={m.name}>
                  <td>
                    <b>{m.name}</b>
                  </td>
                  <td className="num">{m.count}</td>
                  <td className="num">{m.items}</td>
                  <td className="num">{money(m.disc)}</td>
                  <td className="num">
                    <b>{money(m.rev)}</b>
                  </td>
                  <td className="num">{money(m.count ? m.rev / m.count : 0)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon="users" title="No sales in range" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProfitReport({ from }: { from: number }) {
  const { db, money } = useStore();
  const currency = db.settings.currency;
  const list = db.sales.filter((s) => s.createdAt >= from);

  const rev = list.reduce((a, s) => a + s.total, 0);
  const cogs = list.reduce((a, s) => a + s.items.reduce((x, i) => x + i.cost * i.qty, 0), 0);
  const disc = list.reduce((a, s) => a + s.discount, 0);
  const profit = rev - cogs - disc;
  const days = last14Days();

  return (
    <>
      <StatStrip
        stats={[
          { label: 'Revenue', value: money(rev) },
          { label: 'Cost of goods', value: money(cogs) },
          { label: 'Discounts', value: money(disc) },
          { label: 'Gross profit', value: money(profit), accent: true },
          { label: 'Margin', value: `${rev ? Math.round((profit / rev) * 100) : 0}%` },
        ]}
      />
      <div className="card-b">
        <Chart
          height={220}
          config={{
            type: 'bar',
            data: {
              labels: days.map(fdS),
              datasets: [
                {
                  label: 'Daily profit',
                  data: days.map(
                    (d) =>
                      +list
                        .filter((s) => s.createdAt >= d && s.createdAt < d + DAY)
                        .reduce(
                          (a, s) =>
                            a +
                            s.total -
                            s.discount -
                            s.items.reduce((x, i) => x + i.cost * i.qty, 0),
                          0,
                        )
                        .toFixed(2),
                  ),
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
    </>
  );
}
