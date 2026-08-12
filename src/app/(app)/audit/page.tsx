'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/components/store';
import { Badge, EmptyState, Pager, usePaged } from '@/components/ui';
import { userName } from '@/lib/selectors';
import { fd } from '@/lib/utils';

const GROUPS = [
  'all',
  'PRODUCT',
  'CATEGORY',
  'INVENTORY',
  'SALE',
  'PURCHASE',
  'SUPPLIER',
  'USER',
  'SETTINGS',
  'SYSTEM',
];

export default function AuditPage() {
  const { db } = useStore();
  const [group, setGroup] = useState('all');

  const list = useMemo(
    () =>
      [...db.audit].sort((a, b) => b.date - a.date).filter((a) => group === 'all' || a.group === group),
    [db.audit, group],
  );
  const { rows, page, pages, setPage, total } = usePaged(list, 12);

  return (
    <div className="card">
      <div className="toolbar">
        <select
          className="select"
          style={{ width: '170px' }}
          value={group}
          onChange={(e) => {
            setGroup(e.target.value);
            setPage(1);
          }}
        >
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g === 'all' ? 'All activity' : g[0] + g.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Full audit trail of inventory &amp; financial operations.
        </span>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Group</th>
              <th>Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fd(a.date)}</td>
                  <td>{userName(db, a.userId)}</td>
                  <td>
                    <Badge tone="b-gray">{a.group}</Badge>
                  </td>
                  <td>
                    <b>{a.action}</b>
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{a.detail}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon="shield" title="No entries" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager total={total} page={page} pages={pages} onPage={setPage} />
    </div>
  );
}
