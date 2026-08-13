'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/icon';
import { ReceiptModal } from '@/components/receipt';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { Badge, EmptyState, Pager, StatStrip, usePaged } from '@/components/ui';
import { bankShort, payMethodLabel } from '@/lib/banks';
import { exportSalesCsv } from '@/lib/export';
import { userName } from '@/lib/selectors';
import type { Sale } from '@/lib/types';
import { DAY, fd, startOfDay } from '@/lib/utils';

const RANGES = [0, 7, 30, -1];

function rangeLabel(r: number): string {
  return r === 0 ? 'Today' : r === -1 ? 'All time' : `${r} days`;
}

export default function SalesPage() {
  const { db, money } = useStore();
  const toast = useToast();

  const [range, setRange] = useState(30);
  const [cashier, setCashier] = useState(0);
  const [q, setQ] = useState('');
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const list = useMemo(() => {
    const from = range === 0 ? startOfDay(Date.now()) : range === -1 ? 0 : Date.now() - range * DAY;
    return [...db.sales]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(
        (s) =>
          s.createdAt >= from &&
          (!cashier || s.cashierId === cashier) &&
          (!q || s.ref.toLowerCase().includes(q.toLowerCase())),
      );
  }, [db.sales, range, cashier, q]);

  const { rows, page, pages, setPage, total } = usePaged(list, 10);
  const revenue = list.reduce((a, s) => a + s.total, 0);

  return (
    <div className="card">
      <div className="toolbar">
        {RANGES.map((r) => (
          <button
            key={r}
            className={`chip ${range === r ? 'on' : ''}`}
            onClick={() => {
              setRange(r);
              setPage(1);
            }}
          >
            {rangeLabel(r)}
          </button>
        ))}
        <select
          className="select"
          style={{ width: '160px' }}
          value={cashier}
          onChange={(e) => {
            setCashier(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={0}>All cashiers</option>
          {db.users
            .filter((u) => u.role === 'cashier')
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
        <input
          className="input grow"
          placeholder="Search ref…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <button
          className="btn btn-ghost"
          onClick={() => {
            exportSalesCsv(db, list);
            toast('Exported sales-report.csv');
          }}
        >
          <Icon name="download" /> CSV
        </button>
      </div>

      <StatStrip
        bordered
        stats={[
          { label: 'Transactions', value: list.length },
          { label: 'Revenue', value: money(revenue) },
          {
            label: 'Line items',
            value: list.reduce((a, s) => a + s.items.length, 0),
          },
          { label: 'Discounts', value: money(list.reduce((a, s) => a + s.discount, 0)) },
        ]}
      />

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Date</th>
              <th>Cashier</th>
              <th className="num">Items</th>
              <th>Method</th>
              <th>Bank</th>
              <th>Disc.</th>
              <th className="num">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.ref}</b>
                  </td>
                  <td>{fd(s.createdAt)}</td>
                  <td>{userName(db, s.cashierId)}</td>
                  <td className="num">{s.items.length}</td>
                  <td>
                    <Badge tone="b-gray">{payMethodLabel(s.payMethod)}</Badge>
                  </td>
                  <td>
                    {s.bank ? <Badge tone="b-blue">{bankShort(s.bank)}</Badge> : '—'}
                    {s.txnRef || s.txnPhoto ? (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          marginTop: '2px',
                          maxWidth: '130px',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {s.txnRef}
                        {s.txnPhoto ? (s.txnRef ? ' · slip' : 'slip attached') : ''}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {s.discount ? (
                      <Badge tone="b-amber">{s.discountPct}%</Badge>
                    ) : (
                      <Badge tone="b-gray">—</Badge>
                    )}
                  </td>
                  <td className="num">
                    <b>{money(s.total)}</b>
                  </td>
                  <td>
                    <button
                      className="icon-btn sm"
                      title="View / print"
                      onClick={() => setReceipt(s)}
                    >
                      <Icon name="eye" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9}>
                  <EmptyState icon="receipt" title="No sales in this period" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager total={total} page={page} pages={pages} onPage={setPage} />

      <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
