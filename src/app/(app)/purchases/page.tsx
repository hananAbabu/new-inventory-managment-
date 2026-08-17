'use client';

import { useMemo, useState } from 'react';
import {
  createPurchase,
  deletePurchase,
  receivePurchase,
  updatePurchase,
} from '@/app/actions/purchases';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter, useConfirm } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { Badge, EmptyState, Pager, usePaged } from '@/components/ui';
import { BANKS, PAY_METHODS, bankShort, needsBank, payMethodLabel } from '@/lib/banks';
import { describePackaging, packNoun, packSize } from '@/lib/product-types';
import { supName } from '@/lib/selectors';
import type { Bank, PayMethod, Purchase } from '@/lib/types';
import { formatQty, parseQty, qtyMin, qtyStep, roundQty, unitShort } from '@/lib/units';
import { fd } from '@/lib/utils';

export default function PurchasesPage() {
  const { db, run, money } = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [viewing, setViewing] = useState<Purchase | null>(null);

  const list = useMemo(
    () => [...db.purchases].sort((a, b) => b.createdAt - a.createdAt),
    [db.purchases],
  );
  const { rows, page, pages, setPage, total } = usePaged(list, 8);

  function openForm(purchase: Purchase | null) {
    setEditing(purchase);
    setFormOpen(true);
  }

  async function receive(pur: Purchase) {
    if (pur.status === 'received') return;
    if (await run(() => receivePurchase(pur.id))) {
      toast(`${pur.ref} received — stock updated`);
    }
  }

  async function del(pur: Purchase) {
    // A received order has already moved stock; deleting it would leave the
    // inventory log describing goods no order accounts for.
    if (pur.status === 'received') {
      toast('Received orders cannot be deleted — their stock is already in the log', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Delete purchase order',
      message: (
        <>
          Delete <b>{pur.ref}</b> ({supName(db, pur.supplierId)}, {money(pur.total)})? It has not
          been received, so no stock changes.
        </>
      ),
      danger: true,
      confirm: 'Delete',
    });
    if (!ok) return;
    if (await run(() => deletePurchase(pur.id))) toast('Purchase order deleted');
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>Purchase orders</h3>
        <span style={{ marginLeft: 'auto' }}>
          <Badge tone="b-amber">
            {db.purchases.filter((p) => p.status === 'ordered').length} pending
          </Badge>
        </span>
        <button className="btn btn-primary" onClick={() => openForm(null)}>
          <Icon name="plus" /> New purchase
        </button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>Payment</th>
              <th className="num">Items</th>
              <th className="num">Total</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.ref}</b>
                </td>
                <td>{fd(p.createdAt)}</td>
                <td>{supName(db, p.supplierId)}</td>
                <td>
                  <Badge tone="b-gray">{payMethodLabel(p.payMethod)}</Badge>
                  {p.bank ? (
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                      {bankShort(p.bank)}
                    </div>
                  ) : null}
                </td>
                <td className="num">{p.items.length}</td>
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
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="icon-btn sm" title="View" onClick={() => setViewing(p)}>
                    <Icon name="eye" />
                  </button>{' '}
                  <button
                    className="icon-btn sm"
                    title={
                      p.status === 'received'
                        ? 'Received orders cannot be edited'
                        : 'Edit order'
                    }
                    disabled={p.status === 'received'}
                    onClick={() => openForm(p)}
                  >
                    <Icon name="pencil" />
                  </button>{' '}
                  <button
                    className="icon-btn sm danger"
                    title={
                      p.status === 'received'
                        ? 'Received orders cannot be deleted'
                        : 'Delete order'
                    }
                    disabled={p.status === 'received'}
                    onClick={() => del(p)}
                  >
                    <Icon name="trash" />
                  </button>{' '}
                  {p.status === 'ordered' ? (
                    <button
                      className="btn btn-soft"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => receive(p)}
                    >
                      Receive
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager total={total} page={page} pages={pages} onPage={setPage} />

      {formOpen ? (
        <PurchaseForm
          key={editing?.id ?? 'new'}
          purchase={editing}
          onClose={() => setFormOpen(false)}
        />
      ) : null}

      {viewing ? (
        <PurchaseView
          purchase={viewing}
          onClose={() => setViewing(null)}
          onReceive={() => {
            const p = viewing;
            setViewing(null);
            receive(p);
          }}
        />
      ) : null}
    </div>
  );
}

interface DraftLine {
  productId: number;
  /** Entered in supplier packs (sacks, cartons) — converted to stock units on save. */
  packs: number;
  /** Always per stock unit: per kg, per piece, per carton. */
  cost: number;
}

function PurchaseForm({ purchase, onClose }: { purchase: Purchase | null; onClose: () => void }) {
  const { db, run, money } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const [supplierId, setSupplierId] = useState(purchase?.supplierId ?? db.suppliers[0]?.id ?? 0);
  const [payMethod, setPayMethod] = useState<PayMethod>(purchase?.payMethod ?? 'cash');
  const [bank, setBank] = useState<Bank>(purchase?.bank ?? 'cbe');
  const [pick, setPick] = useState(db.products[0]?.id ?? 0);
  const [lines, setLines] = useState<DraftLine[]>(
    purchase
      ? purchase.items.map((i) => {
          const p = db.products.find((x) => x.id === i.productId);
          const size = p ? packSize(p) : 1;
          return { productId: i.productId, packs: roundQty(i.qty / size), cost: i.cost };
        })
      : [],
  );

  const productOf = (id: number) => db.products.find((x) => x.id === id);
  /** Stock units a line brings in: packs × pack size. */
  const stockQty = (l: DraftLine): number => {
    const p = productOf(l.productId);
    return roundQty(l.packs * (p ? packSize(p) : 1));
  };

  const orderTotal = lines.reduce((a, l) => a + stockQty(l) * l.cost, 0);

  function addLine() {
    const p = productOf(Number(pick));
    if (!p) return;
    if (lines.some((l) => l.productId === p.id)) {
      toast('Product already in this order', 'error');
      return;
    }
    setLines((prev) => [...prev, { productId: p.id, packs: 10, cost: p.costPrice }]);
  }

  function editLine(i: number, key: 'packs' | 'cost', value: string) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        if (key === 'cost') return { ...l, cost: Math.max(0, parseFloat(value) || 0) };
        const p = productOf(l.productId);
        const size = p ? packSize(p) : 1;
        // Packs are whole sacks or cartons; only loose stock units can be fractional.
        if (size > 1) {
          const n = parseInt(value, 10);
          return { ...l, packs: Math.max(1, isNaN(n) ? 1 : n) };
        }
        const unit = p?.unit ?? 'pcs';
        const parsed = parseQty(value, unit);
        return { ...l, packs: Math.max(qtyMin(unit), isNaN(parsed) ? qtyMin(unit) : parsed) };
      }),
    );
  }

  async function save(receiveNow: boolean) {
    if (!lines.length) {
      toast('Add at least one product line', 'error');
      return;
    }

    const input = {
      supplierId: Number(supplierId),
      payMethod,
      bank: needsBank(payMethod) ? bank : null,
      // Packs are converted to stock units here, before they reach the server.
      lines: lines.map((l) => ({
        productId: l.productId,
        qty: stockQty(l),
        cost: l.cost,
      })),
      receive: receiveNow,
    };

    setBusy(true);
    const ok = await run(() =>
      purchase ? updatePurchase(purchase.id, input) : createPurchase(input),
    );
    setBusy(false);
    if (!ok) return;

    if (purchase) {
      toast(
        receiveNow
          ? `${purchase.ref} updated and received — inventory updated`
          : `Purchase order ${purchase.ref} updated`,
      );
    } else {
      toast(receiveNow ? 'Purchase received — inventory updated' : 'Purchase order saved');
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={purchase ? `Edit purchase ${purchase.ref}` : 'New purchase order'}
    >
      <ModalBody>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
          <div className="field">
            <label htmlFor="pp-supplier">Supplier *</label>
            <select
              id="pp-supplier"
              className="select"
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
            >
              {db.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="pp-method">Payment method *</label>
            <select
              id="pp-method"
              className="select"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PayMethod)}
            >
              {PAY_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {needsBank(payMethod) ? (
          <div className="field">
            <label htmlFor="pp-bank">Bank *</label>
            <select
              id="pp-bank"
              className="select"
              value={bank}
              onChange={(e) => setBank(e.target.value as Bank)}
            >
              {BANKS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="pp-select">Add products</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              id="pp-select"
              className="select"
              value={pick}
              onChange={(e) => setPick(Number(e.target.value))}
            >
              {db.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} ({describePackaging(p)})
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-soft" onClick={addLine}>
              <Icon name="plus" /> Add
            </button>
          </div>
        </div>

        {lines.length ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ width: '130px' }}>Quantity</th>
                <th style={{ width: '130px' }}>Unit cost</th>
                <th className="num">Line total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const p = db.products.find((x) => x.id === l.productId)!;
                const size = packSize(p);
                const noun = packNoun(p);
                const stock = stockQty(l);
                return (
                  <tr key={l.productId}>
                    <td>
                      <b>{p.sku}</b> {p.name}
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {describePackaging(p)}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                          className="input"
                          type="number"
                          min={size > 1 ? 1 : qtyMin(p.unit)}
                          step={size > 1 ? 1 : qtyStep(p.unit)}
                          value={l.packs}
                          onChange={(e) => editLine(i, 'packs', e.target.value)}
                          aria-label={`Quantity for ${p.sku} in ${noun ?? unitShort(p.unit)}`}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {noun ?? unitShort(p.unit)}
                        </span>
                      </div>
                      {size > 1 ? (
                        <div style={{ fontSize: '11px', color: 'var(--brand)', marginTop: '3px' }}>
                          = {formatQty(stock, p.unit)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.cost}
                        onChange={(e) => editLine(i, 'cost', e.target.value)}
                        aria-label={`Cost per ${unitShort(p.unit)} for ${p.sku}`}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                        per {unitShort(p.unit)}
                      </div>
                    </td>
                    <td className="num">
                      <b>{money(stock * l.cost)}</b>
                    </td>
                    <td>
                      <button
                        className="icon-btn sm danger"
                        onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove ${p.sku}`}
                      >
                        <Icon name="x" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon="inbox"
            title="No lines yet"
            sub="Add products to build this purchase order."
          />
        )}

        <div className="tot-row big" style={{ marginTop: '10px' }}>
          <span>Order total</span>
          <span>{money(orderTotal)}</span>
        </div>
      </ModalBody>

      <ModalFooter>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-ghost" onClick={() => save(false)} disabled={busy}>
          <Icon name="inbox" /> {purchase ? 'Save changes' : 'Save as ordered'}
        </button>
        <button className="btn btn-primary" onClick={() => save(true)} disabled={busy}>
          <Icon name="check" /> Save &amp; receive stock
        </button>
      </ModalFooter>
    </Modal>
  );
}

function PurchaseView({
  purchase,
  onClose,
  onReceive,
}: {
  purchase: Purchase;
  onClose: () => void;
  onReceive: () => void;
}) {
  const { db, money } = useStore();

  return (
    <Modal open onClose={onClose} size="lg" title={`Purchase ${purchase.ref}`}>
      <ModalBody>
        <div
          style={{
            display: 'flex',
            gap: '14px',
            flexWrap: 'wrap',
            marginBottom: '12px',
            fontSize: '12.5px',
            color: 'var(--muted)',
          }}
        >
          <span>
            Supplier: <b style={{ color: 'var(--ink)' }}>{supName(db, purchase.supplierId)}</b>
          </span>
          <span>
            Created: <b style={{ color: 'var(--ink)' }}>{fd(purchase.createdAt)}</b>
          </span>
          <span>
            Paid by:{' '}
            <b style={{ color: 'var(--ink)' }}>
              {payMethodLabel(purchase.payMethod)}
              {purchase.bank ? ` · ${bankShort(purchase.bank)}` : ''}
            </b>
          </span>
          <span>
            Status:{' '}
            {purchase.status === 'received' ? (
              <Badge tone="b-green">Received</Badge>
            ) : (
              <Badge tone="b-amber">Ordered</Badge>
            )}
          </span>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Qty</th>
              <th className="num">Cost</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((i) => (
              <tr key={i.productId}>
                <td>
                  <b>{i.sku}</b> {i.name}
                </td>
                <td className="num">{formatQty(i.qty, i.unit)}</td>
                <td className="num">{money(i.cost)}</td>
                <td className="num">{money(i.qty * i.cost)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={{ textAlign: 'right' }}>
                <b>Grand total</b>
              </td>
              <td className="num">
                <b>{money(purchase.total)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </ModalBody>

      <ModalFooter>
        {purchase.status === 'ordered' ? (
          <button className="btn btn-primary" onClick={onReceive}>
            <Icon name="check" /> Mark received
          </button>
        ) : null}
        <button className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </ModalFooter>
    </Modal>
  );
}
