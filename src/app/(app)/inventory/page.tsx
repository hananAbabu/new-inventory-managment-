'use client';

import { useMemo, useState } from 'react';
import { MovementForm, type MovementType } from '@/components/forms/movement-form';
import { Icon } from '@/components/icon';
import { useStore } from '@/components/store';
import { Badge, EmptyState, Pager, StatStrip, Tabs, usePaged } from '@/components/ui';
import { inventoryValue, retailValue, stockState, txBadge, userName } from '@/lib/selectors';
import type { TxType } from '@/lib/types';
import { formatQty, formatQtyNumber } from '@/lib/units';
import { fd, titleCase } from '@/lib/utils';

type Tab = 'levels' | 'log';
const TX_FILTERS: (TxType | 'all')[] = [
  'all',
  'purchase',
  'sale',
  'received',
  'damage',
  'lost',
  'adjustment',
  'initial',
];

export default function InventoryPage() {
  const { db, money } = useStore();
  const [tab, setTab] = useState<Tab>('levels');
  const [movement, setMovement] = useState<{ productId?: number; type: MovementType } | null>(null);

  const costV = inventoryValue(db);
  const retV = retailValue(db);

  return (
    <>
      <div className="card" style={{ marginBottom: '16px' }}>
        <StatStrip
          stats={[
            { label: 'SKUs', value: db.products.length },
            { label: 'Out of stock', value: db.products.filter((p) => p.qty <= 0).length },
            { label: 'Value at cost', value: money(costV) },
            { label: 'Value at retail', value: money(retV) },
            { label: 'Potential margin', value: money(retV - costV), accent: true },
          ]}
        >
          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={() => setMovement({ type: 'received' })}
          >
            <Icon name="plus" /> Record stock movement
          </button>
        </StatStrip>
      </div>

      <div className="card">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'levels', label: 'Stock levels' },
            { key: 'log', label: 'Movement log' },
          ]}
        />
        {tab === 'levels' ? (
          <StockLevels onMove={(productId, type) => setMovement({ productId, type })} />
        ) : (
          <MovementLog />
        )}
      </div>

      {movement ? (
        <MovementForm
          productId={movement.productId}
          preType={movement.type}
          onClose={() => setMovement(null)}
        />
      ) : null}
    </>
  );
}

function StockLevels({ onMove }: { onMove: (productId: number, type: MovementType) => void }) {
  const { db, money } = useStore();
  const list = useMemo(
    () => [...db.products].sort((a, b) => a.name.localeCompare(b.name)),
    [db.products],
  );
  const { rows, page, pages, setPage, total } = usePaged(list, 10);

  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th className="num">On hand</th>
              <th className="num">Min</th>
              <th>Status</th>
              <th className="num">Cost value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const st = stockState(p);
              return (
                <tr key={p.id}>
                  <td>
                    <b>{p.sku}</b>
                  </td>
                  <td>{p.name}</td>
                  <td className="num">
                    <b>{formatQty(p.qty, p.unit)}</b>
                  </td>
                  <td className="num">{formatQtyNumber(p.minStock)}</td>
                  <td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                  <td className="num">{money(p.qty * p.costPrice)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-soft"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => onMove(p.id, 'received')}
                    >
                      + Receive
                    </button>{' '}
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => onMove(p.id, 'adjustment')}
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager total={total} page={page} pages={pages} onPage={setPage} />
    </>
  );
}

function MovementLog() {
  const { db } = useStore();
  const [type, setType] = useState<TxType | 'all'>('all');
  const [q, setQ] = useState('');

  const list = useMemo(
    () =>
      [...db.invTx]
        .sort((a, b) => b.date - a.date)
        .filter(
          (t) =>
            (type === 'all' || t.type === type) &&
            (!q || (t.name + ' ' + t.sku).toLowerCase().includes(q.toLowerCase())),
        ),
    [db.invTx, type, q],
  );
  const { rows, page, pages, setPage, total } = usePaged(list, 10);

  return (
    <>
      <div className="toolbar" style={{ borderTop: 0 }}>
        <select
          className="select"
          style={{ width: '160px' }}
          value={type}
          onChange={(e) => {
            setType(e.target.value as TxType | 'all');
            setPage(1);
          }}
        >
          {TX_FILTERS.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'All types' : titleCase(t)}
            </option>
          ))}
        </select>
        <input
          className="input grow"
          placeholder="Filter by product…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Type</th>
              <th className="num">Qty change</th>
              <th>Responsible user</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((t) => {
                const b = txBadge(t.type);
                return (
                  <tr key={t.id}>
                    <td>{fd(t.date)}</td>
                    <td>
                      <b>{t.name}</b>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{t.sku}</div>
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
                    <td style={{ color: 'var(--muted)' }}>{t.note || '—'}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon="cube" title="No movements found" sub="Try a different filter." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager total={total} page={page} pages={pages} onPage={setPage} />
    </>
  );
}
