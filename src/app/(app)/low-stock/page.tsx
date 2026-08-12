'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MovementForm } from '@/components/forms/movement-form';
import { useStore } from '@/components/store';
import { Badge, EmptyState } from '@/components/ui';
import { lowStock, supName } from '@/lib/selectors';

export default function LowStockPage() {
  const { db } = useStore();
  const [receiveFor, setReceiveFor] = useState<number | null>(null);

  const low = [...lowStock(db)].sort((a, b) => a.qty - a.minStock - (b.qty - b.minStock));

  return (
    <div className="card">
      <div className="card-h">
        <h3>Low stock monitor</h3>
        <span style={{ marginLeft: 'auto' }}>
          <Badge tone={low.length ? 'b-amber' : 'b-green'}>
            {low.length} product{low.length === 1 ? '' : 's'}
          </Badge>
        </span>
      </div>

      {low.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th className="num">On hand</th>
                <th className="num">Minimum</th>
                <th className="num">Suggested reorder</th>
                <th>Supplier</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {low.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.sku}</b>
                  </td>
                  <td>{p.name}</td>
                  <td className="num">
                    <b style={{ color: 'var(--danger)' }}>{p.qty}</b>
                  </td>
                  <td className="num">{p.minStock}</td>
                  <td className="num">{Math.max(p.minStock * 2 - p.qty, p.minStock)}</td>
                  <td>{supName(db, p.supplierId)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-soft"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => setReceiveFor(p.id)}
                    >
                      Receive stock
                    </button>{' '}
                    <Link
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      href="/purchases"
                    >
                      New purchase
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon="check"
          title="All products are above minimum stock"
          sub="New alerts appear here and in the notification bell."
        />
      )}

      {receiveFor ? (
        <MovementForm productId={receiveFor} preType="received" onClose={() => setReceiveFor(null)} />
      ) : null}
    </div>
  );
}
