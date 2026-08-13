'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { Modal, ModalBody } from '@/components/modal';
import { ReceiptModal } from '@/components/receipt';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { EmptyState } from '@/components/ui';
import { BANKS, PAY_METHODS, bankShort, needsBank, payMethodLabel } from '@/lib/banks';
import { MAX_SLIP_BYTES, compressImage, dataUrlBytes, formatBytes } from '@/lib/image';
import type { Bank, CartLine, PayMethod, Sale, SaleItem } from '@/lib/types';
import { formatQty, formatQtyNumber, parseQty, qtyMin, roundQty, unitShort } from '@/lib/units';
import { nextRef, uid } from '@/lib/utils';

export default function PosPage() {
  const { db, me, update, money } = useStore();
  const toast = useToast();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(0);
  const [scan, setScan] = useState('');
  const [discount, setDiscount] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const grid = useMemo(
    () =>
      db.products.filter(
        (p) =>
          (!cat || p.categoryId === cat) &&
          (!q || (p.name + ' ' + p.sku).toLowerCase().includes(q.toLowerCase())),
      ),
    [db.products, cat, q],
  );

  const totals = useMemo(() => {
    const sub = cart.reduce((a, l) => {
      const p = db.products.find((x) => x.id === l.productId);
      return a + (p ? p.sellPrice * l.qty : 0);
    }, 0);
    const dAmt = (sub * (discount || 0)) / 100;
    const tax = ((sub - dAmt) * (db.settings.taxRate || 0)) / 100;
    return { subtotal: sub, discount: dAmt, tax, total: sub - dAmt + tax };
  }, [cart, db.products, db.settings.taxRate, discount]);

  // Quantities can be kg or litres, so the counter reports lines, not a mixed-unit sum.
  const lineCount = cart.length;

  function addToCart(id: number) {
    const p = db.products.find((x) => x.id === id);
    if (!p) return;
    const line = cart.find((l) => l.productId === id);
    const inCart = line ? line.qty : 0;
    const available = roundQty(p.qty - inCart);
    if (available < qtyMin(p.unit)) {
      toast(`No more stock available for ${p.name}`, 'error');
      return;
    }
    // One unit per click — or the remainder when less than one is left.
    const add = Math.min(1, available);
    setCart((prev) =>
      line
        ? prev.map((l) => (l.productId === id ? { ...l, qty: roundQty(l.qty + add) } : l))
        : [...prev, { productId: id, qty: add }],
    );
  }

  function cartDelta(id: number, direction: 1 | -1) {
    const p = db.products.find((x) => x.id === id);
    const line = cart.find((l) => l.productId === id);
    if (!line || !p) return;
    // Measured goods step by whole units; you can still type an exact amount.
    const step = 1;
    const next = roundQty(line.qty + direction * step);
    if (next < qtyMin(p.unit)) {
      removeLine(id);
      return;
    }
    if (next > p.qty) {
      toast(`Only ${formatQty(p.qty, p.unit)} in stock`, 'error');
      return;
    }
    setCart((prev) => prev.map((l) => (l.productId === id ? { ...l, qty: next } : l)));
  }

  function setQty(id: number, val: string) {
    const p = db.products.find((x) => x.id === id);
    if (!p) return;
    const parsed = parseQty(val, p.unit);
    const q2 = Math.max(qtyMin(p.unit), Math.min(p.qty, isNaN(parsed) ? qtyMin(p.unit) : parsed));
    setCart((prev) => prev.map((l) => (l.productId === id ? { ...l, qty: roundQty(q2) } : l)));
  }

  function removeLine(id: number) {
    setCart((prev) => prev.filter((l) => l.productId !== id));
  }

  function clearCart() {
    setCart([]);
    setDiscount(0);
  }

  function onScan(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = scan.trim().toLowerCase();
    if (!code) return;
    const p = db.products.find((x) => x.sku.toLowerCase() === code);
    if (!p) {
      toast(`No product with SKU "${code}"`, 'error');
      return;
    }
    addToCart(p.id);
    setScan('');
  }

  function onDiscountChange(v: string) {
    const max = db.settings.maxDiscount;
    let d = parseInt(v, 10) || 0;
    if (d < 0) d = 0;
    if (d > max) {
      d = max;
      toast(`Discount capped at ${max}% for your role`, 'warning');
    }
    setDiscount(d);
  }

  function completeSale(
    method: PayMethod,
    bank: Bank | null,
    paid: number,
    txnRef: string | null,
    txnPhoto: string | null,
  ) {
    if (!cart.length) return;
    for (const l of cart) {
      const p = db.products.find((x) => x.id === l.productId);
      if (!p || p.qty < l.qty) {
        toast(`${p ? p.name : 'Item'} has insufficient stock`, 'error');
        return;
      }
    }

    const now = Date.now();
    const items: SaleItem[] = cart.map((l) => {
      const p = db.products.find((x) => x.id === l.productId)!;
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        price: p.sellPrice,
        cost: p.costPrice,
        qty: l.qty,
      };
    });

    const sale: Sale = {
      id: uid(db.sales),
      ref: nextRef('S', db.sales),
      cashierId: me!.id,
      items,
      subtotal: totals.subtotal,
      discountPct: discount,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      payMethod: method,
      bank,
      txnRef,
      txnPhoto,
      amountPaid: paid,
      change: Math.max(0, paid - totals.total),
      createdAt: now,
    };

    update((draft, audit) => {
      draft.sales.push(sale);
      draft.payments.push({
        id: uid(draft.payments),
        saleId: sale.id,
        method,
        bank,
        amount: paid,
        createdAt: now,
      });
      items.forEach((it) => {
        const p = draft.products.find((x) => x.id === it.productId);
        if (!p) return;
        p.qty = roundQty(p.qty - it.qty);
        p.updatedAt = now;
        draft.invTx.push({
          id: uid(draft.invTx),
          date: now,
          productId: p.id,
          sku: it.sku,
          name: it.name,
          unit: it.unit,
          type: 'sale',
          qty: -it.qty,
          userId: me!.id,
          note: 'Sale ' + sale.ref,
        });
      });
      audit(
        'SALE',
        'sale',
        `${sale.ref} · ${money(sale.total)} · ${items.length} lines · ${payMethodLabel(method)}${
          bank ? ' (' + bankShort(bank) + ')' : ''
        }${txnRef ? ' · ref ' + txnRef : ''}${txnPhoto ? ' · slip attached' : ''}`,
      );
    });

    const lowNow = items
      .map((it) => {
        const p = db.products.find((x) => x.id === it.productId);
        return p ? { ...p, qty: roundQty(p.qty - it.qty) } : null;
      })
      .filter((p) => p && p.qty <= p.minStock);

    clearCart();
    setPayOpen(false);
    toast(`Sale ${sale.ref} completed — ${money(sale.total)}`);
    lowNow.forEach((p) =>
      toast(
        `${p!.name} is low on stock (${formatQty(p!.qty, p!.unit)} left, min ${formatQty(
          p!.minStock,
          p!.unit,
        )})`,
        'warning',
      ),
    );
    setReceipt(sale);
  }

  return (
    <>
      <div className="pos-wrap">
        <div className="card">
          <div className="toolbar">
            <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
              <input
                className="input"
                placeholder="Scan / type exact SKU + Enter"
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={onScan}
              />
            </div>
            <div style={{ position: 'relative', flex: 1.4, minWidth: '170px' }}>
              <input
                className="input"
                placeholder="Search products…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <select
              className="select"
              style={{ width: '160px' }}
              value={cat}
              onChange={(e) => setCat(Number(e.target.value))}
            >
              <option value={0}>All categories</option>
              {db.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pos-grid">
            {grid.length ? (
              grid.map((p) => {
                const inCart = cart.find((l) => l.productId === p.id)?.qty ?? 0;
                const avail = roundQty(p.qty - inCart);
                const out = avail < qtyMin(p.unit);
                return (
                  <button
                    key={p.id}
                    className={`p-card ${out ? 'off' : ''}`}
                    onClick={() => addToCart(p.id)}
                    disabled={out}
                  >
                    <span className="p-stk">
                      {out ? (
                        <span className="badge b-red">0</span>
                      ) : p.qty <= p.minStock ? (
                        <span className="badge b-amber">{formatQty(avail, p.unit)}</span>
                      ) : (
                        <span className="badge b-gray">{formatQty(avail, p.unit)}</span>
                      )}
                    </span>
                    <span className="p-name">{p.name}</span>
                    <span className="p-sku">{p.sku}</span>
                    <span className="p-price">
                      {money(p.sellPrice)}
                      <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '11px' }}>
                        {' '}
                        / {unitShort(p.unit)}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <EmptyState
                icon="search"
                title="No products found"
                sub="Try a different search term."
              />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Current sale</h3>
            <span className="badge b-gray" style={{ marginLeft: 'auto' }}>
              {lineCount} item{lineCount === 1 ? '' : 's'}
            </span>
            <button className="icon-btn sm danger" title="Clear" onClick={clearCart}>
              <Icon name="trash" />
            </button>
          </div>

          <div className="card-b" style={{ padding: '14px 16px' }}>
            {cart.length ? (
              <>
                <div style={{ maxHeight: '38vh', overflowY: 'auto', marginBottom: '10px' }}>
                  {cart.map((l) => {
                    const p = db.products.find((x) => x.id === l.productId)!;
                    return (
                      <div className="cart-line" key={l.productId}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: '12.5px' }}>{p.name}</b>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {money(p.sellPrice)} per {unitShort(p.unit)}
                          </div>
                        </div>
                        <div className="qty-box">
                          <button onClick={() => cartDelta(p.id, -1)}>−</button>
                          <input
                            value={formatQtyNumber(l.qty)}
                            onChange={(e) => setQty(p.id, e.target.value)}
                            aria-label={`Quantity for ${p.name} in ${unitShort(p.unit)}`}
                          />
                          <button onClick={() => cartDelta(p.id, 1)}>+</button>
                        </div>
                        <div
                          style={{
                            width: '64px',
                            textAlign: 'right',
                            fontWeight: 800,
                            fontSize: '12.5px',
                          }}
                        >
                          {money(p.sellPrice * l.qty)}
                        </div>
                        <button className="icon-btn sm danger" onClick={() => removeLine(p.id)}>
                          <Icon name="x" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="field" style={{ marginBottom: '8px' }}>
                  <label htmlFor="pos-disc">Discount % (max {db.settings.maxDiscount}%)</label>
                  <input
                    id="pos-disc"
                    className="input"
                    type="number"
                    min="0"
                    max={db.settings.maxDiscount}
                    step="1"
                    value={discount}
                    onChange={(e) => onDiscountChange(e.target.value)}
                  />
                </div>

                <div className="tot-row">
                  <span>Subtotal</span>
                  <span>{money(totals.subtotal)}</span>
                </div>
                {discount ? (
                  <div className="tot-row">
                    <span>Discount ({discount}%)</span>
                    <span style={{ color: 'var(--danger)' }}>−{money(totals.discount)}</span>
                  </div>
                ) : null}
                {db.settings.taxRate ? (
                  <div className="tot-row">
                    <span>Tax ({db.settings.taxRate}%)</span>
                    <span>{money(totals.tax)}</span>
                  </div>
                ) : null}
                <div className="tot-row big">
                  <span>Total</span>
                  <span>{money(totals.total)}</span>
                </div>

                <button
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginTop: '12px',
                    padding: '11px',
                  }}
                  onClick={() => setPayOpen(true)}
                >
                  <Icon name="pos" /> Take payment
                </button>
              </>
            ) : (
              <EmptyState
                icon="pos"
                title="Cart is empty"
                sub="Search or scan products to begin a sale."
              />
            )}
          </div>
        </div>
      </div>

      {payOpen ? (
        <PaymentModal
          total={totals.total}
          itemCount={lineCount}
          discountPct={discount}
          onClose={() => setPayOpen(false)}
          onComplete={completeSale}
        />
      ) : null}

      <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

function PaymentModal({
  total,
  itemCount,
  discountPct,
  onClose,
  onComplete,
}: {
  total: number;
  itemCount: number;
  discountPct: number;
  onClose: () => void;
  onComplete: (
    method: PayMethod,
    bank: Bank | null,
    paid: number,
    txnRef: string | null,
    txnPhoto: string | null,
  ) => void;
}) {
  const { money } = useStore();
  const toast = useToast();
  const [method, setMethod] = useState<PayMethod>('cash');
  const [bank, setBank] = useState<Bank>('cbe');
  const [paidInput, setPaidInput] = useState('');
  const [txnRef, setTxnRef] = useState('');
  const [txnPhoto, setTxnPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const paid = method === 'cash' ? parseFloat(paidInput) : total;
  const change = isNaN(paid) ? 0 : Math.max(0, paid - total);

  const quicks = [
    total,
    Math.ceil(total / 5) * 5,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 20) * 20,
    Math.ceil(total / 50) * 50,
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5);

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await compressImage(file);
      const size = dataUrlBytes(dataUrl);
      if (size > MAX_SLIP_BYTES) {
        toast(
          `That photo is still ${formatBytes(size)} after compression — use a smaller one.`,
          'error',
        );
        return;
      }
      setTxnPhoto(dataUrl);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not read that photo', 'error');
    } finally {
      setPhotoBusy(false);
    }
  }

  function submit() {
    if (method === 'cash' && (isNaN(paid) || paid < total)) {
      toast('Cash received is less than the total', 'error');
      return;
    }
    const ref = txnRef.trim();
    if (needsBank(method)) {
      if (!bank) {
        toast('Select the bank that received the payment', 'error');
        return;
      }
      if (!ref && !txnPhoto) {
        toast('Enter the transaction number or attach the slip photo', 'error');
        return;
      }
    }
    onComplete(
      method,
      needsBank(method) ? bank : null,
      method === 'cash' ? paid : total,
      needsBank(method) ? ref || null : null,
      needsBank(method) ? txnPhoto : null,
    );
  }

  return (
    <Modal open onClose={onClose} title="Accept payment">
      <ModalBody>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              fontWeight: 800,
            }}
          >
            Amount due
          </div>
          <div
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: '34px',
              color: 'var(--brand)',
            }}
          >
            {money(total)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {itemCount} item{itemCount === 1 ? '' : 's'}
            {discountPct ? ` · ${discountPct}% discount` : ''}
          </div>
        </div>

        <div className="field">
          <span>Payment method</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {PAY_METHODS.map((x) => (
              <button
                key={x.value}
                type="button"
                className={`chip ${method === x.value ? 'on' : ''}`}
                style={{ flex: 1, textAlign: 'center', padding: '9px' }}
                onClick={() => setMethod(x.value)}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        {needsBank(method) ? (
          <>
            <div className="field">
              <label htmlFor="pay-bank">Bank *</label>
              <select
                id="pay-bank"
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

            <div className="field">
              <label htmlFor="pay-txn">Transaction number</label>
              <input
                id="pay-txn"
                className="input"
                placeholder="e.g. FT25081300ABCD"
                value={txnRef}
                onChange={(e) => setTxnRef(e.target.value)}
              />
              <span className="hint">
                Enter the reference from the bank, or attach the slip below — one of the two is
                required.
              </span>
            </div>

            <div className="field">
              <label htmlFor="pay-slip">Transfer slip photo</label>
              {txnPhoto ? (
                <div className="slip-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={txnPhoto} alt="Attached transfer slip" />
                  <div className="slip-actions">
                    <span>{formatBytes(dataUrlBytes(txnPhoto))} attached</span>
                    <button type="button" className="btn btn-ghost" onClick={() => setTxnPhoto(null)}>
                      <Icon name="trash" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  id="pay-slip"
                  className="input"
                  type="file"
                  accept="image/*"
                  disabled={photoBusy}
                  onChange={(e) => onPickPhoto(e.target.files?.[0])}
                />
              )}
              {photoBusy ? <span className="hint">Compressing photo…</span> : null}
            </div>
          </>
        ) : null}

        {method === 'cash' ? (
          <>
            <div className="field">
              <label htmlFor="paid-in">Amount received</label>
              <input
                id="paid-in"
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {quicks.map((qv) => (
                <button
                  key={qv}
                  type="button"
                  className="chip"
                  onClick={() => setPaidInput(qv.toFixed(2))}
                >
                  {money(qv)}
                </button>
              ))}
            </div>
            <div
              className="tot-row big"
              style={{
                background: !isNaN(paid) && paid >= total ? 'var(--brand-soft)' : 'var(--danger-soft)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}
            >
              <span>Change due</span>
              <span>{isNaN(paid) ? money(0) : money(change)}</span>
            </div>
          </>
        ) : (
          <div
            className="tot-row"
            style={{ background: 'var(--blue-soft)', borderRadius: '10px', padding: '10px 14px' }}
          >
            <span>
              {method === 'transfer' ? 'Transfer into' : 'Debit through'} {bankShort(bank)}
            </span>
            <b>{money(total)}</b>
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: '14px', padding: '12px' }}
          onClick={submit}
        >
          <Icon name="check" /> Complete sale
        </button>
      </ModalBody>
    </Modal>
  );
}
