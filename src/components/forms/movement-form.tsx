'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import type { TxType } from '@/lib/types';
import { formatQty, parseQty, qtyStep, roundQty, unitShort } from '@/lib/units';
import { uid } from '@/lib/utils';

type MovementType = Extract<TxType, 'received' | 'damage' | 'lost' | 'adjustment'>;

const TYPE_LABELS: Record<MovementType, string> = {
  received: 'Stock received (manual)',
  damage: 'Damaged / write-off',
  lost: 'Lost / missing',
  adjustment: 'Manual adjustment (±)',
};

export function MovementForm({
  productId,
  preType = 'received',
  onClose,
}: {
  productId?: number;
  preType?: MovementType;
  onClose: () => void;
}) {
  const { db, me, update } = useStore();
  const toast = useToast();

  const [pid, setPid] = useState(productId ?? db.products[0]?.id ?? 0);
  const [type, setType] = useState<MovementType>(preType);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  const selectedUnit = db.products.find((x) => x.id === Number(pid))?.unit ?? 'pcs';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const product = db.products.find((x) => x.id === Number(pid));
    if (!product) {
      toast('Select a product', 'error');
      return;
    }
    const qtyV = parseQty(qty, product.unit);
    if (isNaN(qtyV) || qtyV === 0) {
      toast('Quantity cannot be zero', 'error');
      return;
    }
    if (type !== 'adjustment' && qtyV < 0) {
      toast('Quantity must be positive for this type', 'error');
      return;
    }
    const delta = type === 'received' ? qtyV : type === 'adjustment' ? qtyV : -qtyV;
    if (roundQty(product.qty + delta) < 0) {
      toast(`Insufficient stock — only ${formatQty(product.qty, product.unit)} on hand`, 'error');
      return;
    }

    const now = Date.now();
    update((draft, audit) => {
      const p = draft.products.find((x) => x.id === product.id);
      if (!p) return;
      p.qty = roundQty(p.qty + delta);
      p.updatedAt = now;
      draft.invTx.push({
        id: uid(draft.invTx),
        date: now,
        productId: p.id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        type,
        qty: delta,
        userId: me!.id,
        note: note.trim(),
      });
      audit(
        'INVENTORY',
        type,
        `${delta > 0 ? '+' : ''}${formatQty(delta, p.unit)} · ${p.sku}${
          note.trim() ? ' · ' + note.trim() : ''
        }`,
      );
    });

    toast('Stock movement recorded');
    const after = roundQty(product.qty + delta);
    if (after <= product.minStock)
      toast(
        `${product.name} is now at/below minimum stock (${formatQty(after, product.unit)} left)`,
        'warning',
      );
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Record stock movement">
      <form onSubmit={onSubmit}>
        <ModalBody>
          <div className="field">
            <label htmlFor="mv-product">Product *</label>
            <select
              id="mv-product"
              className="select"
              value={pid}
              onChange={(e) => setPid(Number(e.target.value))}
              required
            >
              {db.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (on hand: {formatQty(p.qty, p.unit)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="field">
              <label htmlFor="mv-type">Movement type *</label>
              <select
                id="mv-type"
                className="select"
                value={type}
                onChange={(e) => setType(e.target.value as MovementType)}
              >
                {(Object.keys(TYPE_LABELS) as MovementType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mv-qty">Quantity ({unitShort(selectedUnit)}) *</label>
              <input
                id="mv-qty"
                className="input"
                type="number"
                required
                step={qtyStep(selectedUnit)}
                placeholder="e.g. 10 (or ± for adjustment)"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="mv-note">Note</label>
            <input
              id="mv-note"
              className="input"
              placeholder="Optional reason / reference"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="hint" style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Received adds stock · damaged &amp; lost remove stock · adjustment accepts positive or
            negative values. Every movement is logged with your user account.
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            <Icon name="check" /> Save movement
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export type { MovementType };
