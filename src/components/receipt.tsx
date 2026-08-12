'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';
import { Modal, ModalBody, ModalFooter } from './modal';
import { useStore } from './store';
import { userName } from '@/lib/selectors';
import type { Sale } from '@/lib/types';
import { fd } from '@/lib/utils';

export function ReceiptView({ sale }: { sale: Sale }) {
  const { db, money } = useStore();
  const st = db.settings;

  return (
    <div className="receipt">
      <div className="r-logo">{st.shopName}</div>
      <div className="r-sub">
        {st.address}
        <br />
        {st.phone}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
        <span>{sale.ref}</span>
        <span>{fd(sale.createdAt)}</span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
        Cashier: {userName(db, sale.cashierId)}
      </div>
      <div className="r-dash" />
      <table>
        <tbody>
          {sale.items.map((i) => (
            <tr key={i.productId}>
              <td>
                {i.qty} × {i.name}
                <br />
                <span style={{ color: 'var(--muted)' }}>{i.sku}</span>
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(i.price * i.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="r-dash" />
      <table>
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td style={{ textAlign: 'right' }}>{money(sale.subtotal)}</td>
          </tr>
          {sale.discount ? (
            <tr>
              <td>Discount ({sale.discountPct}%)</td>
              <td style={{ textAlign: 'right' }}>−{money(sale.discount)}</td>
            </tr>
          ) : null}
          {sale.tax ? (
            <tr>
              <td>Tax</td>
              <td style={{ textAlign: 'right' }}>{money(sale.tax)}</td>
            </tr>
          ) : null}
          <tr className="r-tot">
            <td>TOTAL</td>
            <td style={{ textAlign: 'right' }}>{money(sale.total)}</td>
          </tr>
          <tr>
            <td>Paid ({sale.payMethod})</td>
            <td style={{ textAlign: 'right' }}>{money(sale.amountPaid)}</td>
          </tr>
          <tr>
            <td>Change</td>
            <td style={{ textAlign: 'right' }}>{money(sale.change)}</td>
          </tr>
        </tbody>
      </table>
      <div className="r-dash" />
      <div className="r-foot">{st.receiptFooter}</div>
    </div>
  );
}

/** Mirrors the receipt into #print-area, which is the only thing @media print shows. */
function PrintPortal({ sale }: { sale: Sale }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(document.getElementById('print-area')), []);
  if (!target) return null;
  return createPortal(<ReceiptView sale={sale} />, target);
}

export function ReceiptModal({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  if (!sale) return null;
  return (
    <>
      <PrintPortal sale={sale} />
      <Modal open onClose={onClose} title={`Receipt ${sale.ref}`} size="sm">
        <ModalBody style={{ background: '#f2f6f3' }}>
          <ReceiptView sale={sale} />
        </ModalBody>
        <ModalFooter>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon name="print" /> Print receipt
          </button>
        </ModalFooter>
      </Modal>
    </>
  );
}
