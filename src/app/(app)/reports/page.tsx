'use client';

import { useMemo, useState } from 'react';
import { Chart, PALETTE } from '@/components/chart';
import { Icon } from '@/components/icon';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { Badge, EmptyState, StatStrip } from '@/components/ui';
import { BANKS, bankShort, payMethodLabel } from '@/lib/banks';
import { exportSalesCsv } from '@/lib/export';
import { lowStock, stockState, supName, userName } from '@/lib/selectors';
import type { Role, Unit } from '@/lib/types';
import { formatQty, formatQtyNumber } from '@/lib/units';
import { DAY, fd, fdS, startOfDay } from '@/lib/utils';

type ReportTab =
  | 'sales'
  | 'purchases'
  | 'banks'
  | 'inventory'
  | 'lowstock'
  | 'performance'
  | 'cashiers'
  | 'profit';

const REPORT_TABS: { key: ReportTab; label: string; roles: Role[] }[] = [
  { key: 'sales', label: 'Sales', roles: ['admin', 'storekeeper'] },
  { key: 'purchases', label: 'Purchases', roles: ['admin'] },
  { key: 'banks', label: 'Banks', roles: ['admin'] },
  { key: 'inventory', label: 'Inventory', roles: ['admin', 'storekeeper'] },
  { key: 'lowstock', label: 'Low Stock', roles: ['admin', 'storekeeper'] },
  { key: 'performance', label: 'Product Performance', roles: ['admin'] },
  { key: 'cashiers', label: 'Cashier Sales', roles: ['admin'] },
  { key: 'profit', label: 'Profit', roles: ['admin'] },
];

const RANGED_TABS: ReportTab[] = ['sales', 'banks', 'performance', 'cashiers', 'profit'];
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
        {active === 'banks' ? <BanksReport from={from} /> : null}
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
            label: 'Line items',
            value: list.reduce((a, s) => a + s.items.length, 0),
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
              <th>Payment</th>
              <th>Bank</th>
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
                <td>{payMethodLabel(p.payMethod)}</td>
                <td>{p.bank ? <Badge tone="b-blue">{bankShort(p.bank)}</Badge> : '—'}</td>
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

/** Money in and out per bank, so each account can be reconciled on its own. */
function BanksReport({ from }: { from: number }) {
  const { db, money } = useStore();
  const currency = db.settings.currency;

  const rows = useMemo(() => {
    const sales = db.sales.filter((s) => s.createdAt >= from && s.bank);
    const purchases = db.purchases.filter(
      (p) => p.createdAt >= from && p.bank && p.status === 'received',
    );

    return BANKS.map((b) => {
      const inSales = sales.filter((s) => s.bank === b.value);
      const outPurchases = purchases.filter((p) => p.bank === b.value);
      const inAmt = inSales.reduce((a, s) => a + s.total, 0);
      const outAmt = outPurchases.reduce((a, p) => a + p.total, 0);
      return {
        bank: b,
        salesCount: inSales.length,
        inAmt,
        purchaseCount: outPurchases.length,
        outAmt,
        net: inAmt - outAmt,
      };
    }).filter((r) => r.salesCount || r.purchaseCount);
  }, [db.sales, db.purchases, from]);

  const cashSales = db.sales.filter((s) => s.createdAt >= from && !s.bank);
  const cashPurchases = db.purchases.filter(
    (p) => p.createdAt >= from && !p.bank && p.status === 'received',
  );
  const totalIn = rows.reduce((a, r) => a + r.inAmt, 0);
  const totalOut = rows.reduce((a, r) => a + r.outAmt, 0);

  return (
    <>
      <StatStrip
        stats={[
          { label: 'Received via bank', value: money(totalIn) },
          { label: 'Paid via bank', value: money(totalOut) },
          { label: 'Net through banks', value: money(totalIn - totalOut), accent: true },
          { label: 'Cash sales', value: money(cashSales.reduce((a, s) => a + s.total, 0)) },
          {
            label: 'Cash purchases',
            value: money(cashPurchases.reduce((a, p) => a + p.total, 0)),
          },
        ]}
      />

      {rows.length ? (
        <>
          <div className="card-b">
            <Chart
              height={230}
              config={{
                type: 'bar',
                data: {
                  labels: rows.map((r) => r.bank.short),
                  datasets: [
                    {
                      label: 'Received (sales)',
                      data: rows.map((r) => +r.inAmt.toFixed(2)),
                      backgroundColor: '#0e7c5b',
                      borderRadius: 6,
                      maxBarThickness: 34,
                    },
                    {
                      label: 'Paid (purchases)',
                      data: rows.map((r) => +r.outAmt.toFixed(2)),
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
                  <th>Bank</th>
                  <th className="num">Sales</th>
                  <th className="num">Received</th>
                  <th className="num">Purchases</th>
                  <th className="num">Paid out</th>
                  <th className="num">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.bank.value}>
                    <td>
                      <b>{r.bank.short}</b>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{r.bank.label}</div>
                    </td>
                    <td className="num">{r.salesCount}</td>
                    <td className="num">
                      <b style={{ color: 'var(--brand)' }}>{money(r.inAmt)}</b>
                    </td>
                    <td className="num">{r.purchaseCount}</td>
                    <td className="num">
                      <b style={{ color: 'var(--amber)' }}>{money(r.outAmt)}</b>
                    </td>
                    <td className="num">
                      <b style={{ color: r.net < 0 ? 'var(--danger)' : 'var(--ink)' }}>
                        {money(r.net)}
                      </b>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>Totals</b>
                  </td>
                  <td className="num">
                    <b>{rows.reduce((a, r) => a + r.salesCount, 0)}</b>
                  </td>
                  <td className="num">
                    <b>{money(totalIn)}</b>
                  </td>
                  <td className="num">
                    <b>{rows.reduce((a, r) => a + r.purchaseCount, 0)}</b>
                  </td>
                  <td className="num">
                    <b>{money(totalOut)}</b>
                  </td>
                  <td className="num">
                    <b>{money(totalIn - totalOut)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState
          icon="chart"
          title="No bank transactions in range"
          sub="Sales and purchases settled in cash do not appear here."
        />
      )}
    </>
  );
}

function InventoryReport() {
  const { db, me, money } = useStore();
  // Stock valuation is owner information; the storekeeper sees quantities only.
  const showValues = me!.role === 'admin';
  const list = showValues
    ? [...db.products].sort((a, b) => b.qty * b.costPrice - a.qty * a.costPrice)
    : [...db.products].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th className="num">On hand</th>
            <th className="num">Minimum</th>
            {showValues ? <th className="num">Cost value</th> : null}
            {showValues ? <th className="num">Retail value</th> : null}
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
                <td className="num">{formatQty(p.qty, p.unit)}</td>
                <td className="num">{formatQtyNumber(p.minStock)}</td>
                {showValues ? <td className="num">{money(p.qty * p.costPrice)}</td> : null}
                {showValues ? <td className="num">{money(p.qty * p.sellPrice)}</td> : null}
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
              {/* Quantities mix pieces, kilograms and litres, so only the money adds up. */}
              <b>{db.products.length} SKUs</b>
            </td>
            <td className="num">
              <b>{db.products.filter((p) => p.qty <= p.minStock).length} low</b>
            </td>
            {showValues ? (
              <td className="num">
                <b>{money(db.products.reduce((a, p) => a + p.qty * p.costPrice, 0))}</b>
              </td>
            ) : null}
            {showValues ? (
              <td className="num">
                <b>{money(db.products.reduce((a, p) => a + p.qty * p.sellPrice, 0))}</b>
              </td>
            ) : null}
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
              <td className="num">{formatQty(p.qty, p.unit)}</td>
              <td className="num">{formatQtyNumber(p.minStock)}</td>
              <td className="num" style={{ color: 'var(--danger)' }}>
                <b>{formatQty(Math.max(0, p.minStock - p.qty), p.unit)}</b>
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
      { name: string; sku: string; unit: Unit; units: number; rev: number; profit: number }
    > = {};
    db.sales
      .filter((s) => s.createdAt >= from)
      .forEach((s) =>
        s.items.forEach((i) => {
          const m =
            map[i.productId] ||
            (map[i.productId] = {
              name: i.name,
              sku: i.sku,
              unit: i.unit,
              units: 0,
              rev: 0,
              profit: 0,
            });
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
                  <td className="num">{formatQty(m.units, m.unit)}</td>
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
        m.items += s.items.length;
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
