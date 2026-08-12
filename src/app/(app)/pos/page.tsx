'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { Modal, ModalBody } from '@/components/modal';
import { ReceiptModal } from '@/components/receipt';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { EmptyState } from '@/components/ui';
import type { CartLine, PayMethod, Sale, SaleItem } from '@/lib/types';
import { nextRef, titleCase, uid } from '@/lib/utils';

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

  const count = cart.reduce((a, l) => a + l.qty, 0);

  function addToCart(id: number) {
    const p = db.products.find((x) => x.id === id);
    if (!p) return;
    const line = cart.find((l) => l.productId === id);
    const inCart = line ? line.qty : 0;
    if (p.qty - inCart <= 0) {
      toast(`No more stock available for ${p.name}`, 'error');
      return;
    }
    setCart((prev) =>
      line
        ? prev.map((l) => (l.productId === id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { productId: id, qty: 1 }],
    );
  }

  function cartDelta(id: number, d: number) {
    const p = db.products.find((x) => x.id === id);
    const line = cart.find((l) => l.productId === id);
    if (!line || !p) return;
    const next = line.qty + d;
    if (next < 1) {
      removeLine(id);
      return;
    }
    if (next > p.qty) {
      toast(`Only ${p.qty} in stock`, 'error');
      return;
    }
    setCart((prev) => prev.map((l) => (l.productId === id ? { ...l, qty: next } : l)));
  }

  function setQty(id: number, val: string) {
    const p = db.products.find((x) => x.id === id);
    if (!p) return;
    const q2 = Math.max(1, Math.min(p.qty, parseInt(val, 10) || 1));
    setCart((prev) => prev.map((l) => (l.productId === id ? { ...l, qty: q2 } : l)));
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

  function completeSale(method: PayMethod, paid: number) {
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
        amount: paid,
        createdAt: now,
      });
      items.forEach((it) => {
        const p = draft.products.find((x) => x.id === it.productId);
        if (!p) return;
        p.qty -= it.qty;
        p.updatedAt = now;
        draft.invTx.push({
          id: uid(draft.invTx),
          date: now,
          productId: p.id,
          sku: it.sku,
          name: it.name,
          type: 'sale',
          qty: -it.qty,
          userId: me!.id,
          note: 'Sale ' + sale.ref,
        });
      });
      audit(
        'SALE',
        'sale',
        `${sale.ref} · ${money(sale.total)} · ${items.reduce((a, b) => a + b.qty, 0)} items · ${method}`,
      );
    });

    const lowNow = items
      .map((it) => {
        const p = db.products.find((x) => x.id === it.productId);
        return p ? { ...p, qty: p.qty - it.qty } : null;
      })
      .filter((p) => p && p.qty <= p.minStock);

    clearCart();
    setPayOpen(false);
    toast(`Sale ${sale.ref} completed — ${money(sale.total)}`);
    lowNow.forEach((p) =>
      toast(`${p!.name} is low on stock (${p!.qty} left, min ${p!.minStock})`, 'warning'),
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
                const avail = p.qty - inCart;
                return (
                  <button
                    key={p.id}
                    className={`p-card ${avail <= 0 ? 'off' : ''}`}
                    onClick={() => addToCart(p.id)}
                    disabled={avail <= 0}
                  >
                    <span className="p-stk">
                      {avail <= 0 ? (
                        <span className="badge b-red">0</span>
                      ) : p.qty <= p.minStock ? (
                        <span className="badge b-amber">{avail}</span>
                      ) : (
                        <span className="badge b-gray">{avail}</span>
                      )}
                    </span>
                    <span className="p-name">{p.name}</span>
                    <span className="p-sku">{p.sku}</span>
                    <span className="p-price">{money(p.sellPrice)}</span>
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
              {count} item{count === 1 ? '' : 's'}
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
                            {money(p.sellPrice)} each
                          </div>
                        </div>
                        <div className="qty-box">
                          <button onClick={() => cartDelta(p.id, -1)}>−</button>
                          <input
                            value={l.qty}
                            onChange={(e) => setQty(p.id, e.target.value)}
                            aria-label={`Quantity for ${p.name}`}
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
          itemCount={count}
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
  onComplete: (method: PayMethod, paid: number) => void;
}) {
  const { money } = useStore();
  const toast = useToast();
  const [method, setMethod] = useState<PayMethod>('cash');
  const [paidInput, setPaidInput] = useState('');

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

  function submit() {
    if (method === 'cash' && (isNaN(paid) || paid < total)) {
      toast('Cash received is less than the total', 'error');
      return;
    }
    onComplete(method, method === 'cash' ? paid : total);
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
            {itemCount} items{discountPct ? ` · ${discountPct}% discount` : ''}
          </div>
        </div>

        <div className="field">
          <span>Payment method</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['cash', 'card', 'mobile'] as PayMethod[]).map((x) => (
              <button
                key={x}
                type="button"
                className={`chip ${method === x ? 'on' : ''}`}
                style={{ flex: 1, textAlign: 'center', padding: '9px' }}
                onClick={() => setMethod(x)}
              >
                {titleCase(x)}
              </button>
            ))}
          </div>
        </div>

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
            <span>{method === 'card' ? 'Card terminal' : 'Mobile wallet'} will charge</span>
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
