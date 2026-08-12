'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Icon } from '@/components/icon';
import { ReceiptModal } from '@/components/receipt';
import { useStore } from '@/components/store';
import { Badge, EmptyState, Pager, usePaged } from '@/components/ui';
import type { Sale } from '@/lib/types';
import { fd } from '@/lib/utils';

export default function MySalesPage() {
  const { db, me, money } = useStore();
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const mine = useMemo(
    () => db.sales.filter((s) => s.cashierId === me!.id).sort((a, b) => b.createdAt - a.createdAt),
    [db.sales, me],
  );
  const { rows, page, pages, setPage, total } = usePaged(mine, 10);

  return (
    <div className="card">
      <div className="card-h">
        <h3>My sales transactions</h3>
        <span style={{ marginLeft: 'auto' }}>
          <Badge tone="b-green">
            {mine.length} total · {money(mine.reduce((a, s) => a + s.total, 0))}
          </Badge>
        </span>
        <Link className="btn btn-primary" href="/pos">
          <Icon name="pos" /> New sale
        </Link>
      </div>

      {mine.length ? (
        <>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Date</th>
                  <th className="num">Items</th>
                  <th>Method</th>
                  <th className="num">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.ref}</b>
                    </td>
                    <td>{fd(s.createdAt)}</td>
                    <td className="num">{s.items.reduce((a, i) => a + i.qty, 0)}</td>
                    <td>
                      <Badge tone="b-gray">{s.payMethod}</Badge>
                    </td>
                    <td className="num">
                      <b>{money(s.total)}</b>
                    </td>
                    <td>
                      <button className="icon-btn sm" onClick={() => setReceipt(s)} title="View receipt">
                        <Icon name="eye" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={total} page={page} pages={pages} onPage={setPage} />
        </>
      ) : (
        <EmptyState
          icon="receipt"
          title="No sales yet"
          sub="Head to the register to record your first sale."
        />
      )}

      <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
