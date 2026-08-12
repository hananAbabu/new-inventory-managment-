'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import type { Product } from '@/lib/types';
import { uid } from '@/lib/utils';

interface Props {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}

export function ProductForm({ open, product, onClose }: Props) {
  const { db, me, update } = useStore();
  const toast = useToast();

  const [sku, setSku] = useState(product?.sku ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? db.categories[0]?.id ?? 0);
  const [supplierId, setSupplierId] = useState(product?.supplierId ?? 0);
  const [cost, setCost] = useState(product ? String(product.costPrice) : '');
  const [price, setPrice] = useState(product ? String(product.sellPrice) : '');
  const [qty, setQty] = useState('0');
  const [minStock, setMinStock] = useState(String(product?.minStock ?? 5));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const skuV = sku.trim();
    const nameV = name.trim();
    if (!skuV || !nameV) {
      toast('SKU and name are required', 'error');
      return;
    }
    if (db.products.some((p) => p.sku.toLowerCase() === skuV.toLowerCase() && p.id !== product?.id)) {
      toast('A product with this SKU already exists', 'error');
      return;
    }
    const costV = parseFloat(cost);
    const priceV = parseFloat(price);
    const minV = parseInt(minStock, 10);
    if (!(costV >= 0) || !(priceV >= 0) || !(minV >= 0)) {
      toast('Prices and minimum stock must be valid numbers', 'error');
      return;
    }

    const now = Date.now();
    const supId = Number(supplierId) || null;

    if (product) {
      update((draft, audit) => {
        const p = draft.products.find((x) => x.id === product.id);
        if (!p) return;
        Object.assign(p, {
          sku: skuV,
          name: nameV,
          categoryId: Number(categoryId),
          supplierId: supId,
          costPrice: costV,
          sellPrice: priceV,
          minStock: minV,
          updatedAt: now,
        });
        audit('PRODUCT', 'edit', `Updated ${skuV} — ${nameV}`);
      });
      toast('Product updated');
    } else {
      const startQty = Math.max(0, parseInt(qty, 10) || 0);
      update((draft, audit) => {
        const np: Product = {
          id: uid(draft.products),
          sku: skuV,
          name: nameV,
          categoryId: Number(categoryId),
          supplierId: supId,
          costPrice: costV,
          sellPrice: priceV,
          qty: startQty,
          minStock: minV,
          createdAt: now,
          updatedAt: now,
        };
        draft.products.push(np);
        if (startQty > 0)
          draft.invTx.push({
            id: uid(draft.invTx),
            date: now,
            productId: np.id,
            sku: skuV,
            name: nameV,
            type: 'initial',
            qty: startQty,
            userId: me!.id,
            note: 'Opening stock',
          });
        audit('PRODUCT', 'add', `Added ${skuV} — ${nameV}`);
      });
      toast('Product added');
      if (startQty <= minV) toast(`${skuV} created at/below minimum stock`, 'warning');
    }

    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={product ? 'Edit product' : 'Add new product'}
    >
      <form onSubmit={onSubmit}>
        <ModalBody>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="field">
              <label htmlFor="pf-sku">SKU / Code *</label>
              <input
                id="pf-sku"
                className="input"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                placeholder="e.g. TS-1010"
              />
            </div>
            <div className="field">
              <label htmlFor="pf-name">Product name *</label>
              <input
                id="pf-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pf-cat">Category *</label>
              <select
                id="pf-cat"
                className="select"
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                required
              >
                {db.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pf-sup">Supplier</label>
              <select
                id="pf-sup"
                className="select"
                value={supplierId ?? 0}
                onChange={(e) => setSupplierId(Number(e.target.value))}
              >
                <option value={0}>— none —</option>
                {db.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pf-cost">Purchase price (cost) *</label>
              <input
                id="pf-cost"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pf-price">Selling price *</label>
              <input
                id="pf-price"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            {product ? null : (
              <div className="field">
                <label htmlFor="pf-qty">Initial quantity</label>
                <input
                  id="pf-qty"
                  className="input"
                  type="number"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="pf-min">Minimum stock level *</label>
              <input
                id="pf-min"
                className="input"
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                required
              />
              <span className="hint">Alerts trigger at or below this level.</span>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            <Icon name="check" /> {product ? 'Save changes' : 'Create product'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
