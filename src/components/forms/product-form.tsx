'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import {
  PRODUCT_TYPES,
  needsKgPerPiece,
  needsPiecesPerCarton,
  stockUnitFor,
  typeDef,
} from '@/lib/product-types';
import type { Product, ProductType, Unit } from '@/lib/types';
import { UNITS, formatQty, parseQty, qtyStep, unitShort } from '@/lib/units';
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
  const [productType, setProductType] = useState<ProductType>(product?.productType ?? 'piece');
  const [freeUnit, setFreeUnit] = useState<Unit>(product?.unit ?? 'pcs');
  const [kgPerPiece, setKgPerPiece] = useState(
    product?.kgPerPiece != null ? String(product.kgPerPiece) : '',
  );
  const [piecesPerCarton, setPiecesPerCarton] = useState(
    product?.piecesPerCarton != null ? String(product.piecesPerCarton) : '',
  );
  const [cost, setCost] = useState(product ? String(product.costPrice) : '');
  const [price, setPrice] = useState(product ? String(product.sellPrice) : '');
  const [qty, setQty] = useState('0');
  const [minStock, setMinStock] = useState(String(product?.minStock ?? 5));

  // A configured type fixes the stock and price unit; 'unset' lets it be chosen.
  const unit: Unit = stockUnitFor(productType) ?? freeUnit;
  const def = typeDef(productType);

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
    const minV = parseQty(minStock, unit);
    if (!(costV >= 0) || !(priceV >= 0) || !(minV >= 0)) {
      toast('Prices and minimum stock must be valid numbers', 'error');
      return;
    }

    // Packaging numbers only apply to the types that define them.
    const kgV = needsKgPerPiece(productType) ? parseFloat(kgPerPiece) : NaN;
    if (needsKgPerPiece(productType) && !(kgV > 0)) {
      toast('Enter how many kilograms are in one sack', 'error');
      return;
    }
    const pcsV = needsPiecesPerCarton(productType) ? parseInt(piecesPerCarton, 10) : NaN;
    if (productType === 'carton-piece' && !(pcsV > 0)) {
      toast('Enter how many pieces are in one carton', 'error');
      return;
    }

    const packaging = {
      kgPerPiece: needsKgPerPiece(productType) && kgV > 0 ? kgV : null,
      piecesPerCarton: needsPiecesPerCarton(productType) && pcsV > 0 ? pcsV : null,
    };

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
          productType,
          unit,
          ...packaging,
          costPrice: costV,
          sellPrice: priceV,
          minStock: minV,
          updatedAt: now,
        });
        audit('PRODUCT', 'edit', `Updated ${skuV} — ${nameV}`);
      });
      toast('Product updated');
    } else {
      const parsedQty = parseQty(qty, unit);
      const startQty = Math.max(0, isNaN(parsedQty) ? 0 : parsedQty);
      update((draft, audit) => {
        const np: Product = {
          id: uid(draft.products),
          sku: skuV,
          name: nameV,
          categoryId: Number(categoryId),
          supplierId: supId,
          productType,
          unit,
          ...packaging,
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
            unit,
            type: 'initial',
            qty: startQty,
            userId: me!.id,
            note: 'Opening stock',
          });
        audit('PRODUCT', 'add', `Added ${skuV} — ${nameV} (${unitShort(unit)})`);
      });
      toast('Product added');
      if (startQty <= minV)
        toast(`${skuV} created at/below minimum stock (${formatQty(startQty, unit)})`, 'warning');
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
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="pf-type">Product configuration *</label>
              <select
                id="pf-type"
                className="select"
                value={productType}
                onChange={(e) => setProductType(e.target.value as ProductType)}
                required
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="hint">
                {def.hint}
                {def.stockUnit ? ` Stock and prices are in ${unitShort(def.stockUnit)}.` : ''}
              </span>
            </div>

            {productType === 'unset' ? (
              <div className="field">
                <label htmlFor="pf-unit">Unit of measure *</label>
                <select
                  id="pf-unit"
                  className="select"
                  value={freeUnit}
                  onChange={(e) => setFreeUnit(e.target.value as Unit)}
                  required
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Kilogram and litre accept fractions; pieces and cartons do not.
                </span>
              </div>
            ) : null}

            {needsKgPerPiece(productType) ? (
              <div className="field">
                <label htmlFor="pf-kg">Kilograms per sack *</label>
                <input
                  id="pf-kg"
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={kgPerPiece}
                  onChange={(e) => setKgPerPiece(e.target.value)}
                  placeholder="e.g. 50"
                  required
                />
                <span className="hint">Purchases are entered in sacks and converted to kg.</span>
              </div>
            ) : null}

            {needsPiecesPerCarton(productType) ? (
              <div className="field">
                <label htmlFor="pf-pcs">
                  Pieces per carton {productType === 'carton-piece' ? '*' : ''}
                </label>
                <input
                  id="pf-pcs"
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  value={piecesPerCarton}
                  onChange={(e) => setPiecesPerCarton(e.target.value)}
                  placeholder="e.g. 4"
                  required={productType === 'carton-piece'}
                />
                <span className="hint">
                  {productType === 'carton-piece'
                    ? 'Purchases are entered in cartons and converted to pieces.'
                    : 'Recorded for reference — stock and prices stay per carton.'}
                </span>
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="pf-cost">Purchase price (cost) — per {unitShort(unit)} *</label>
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
              <label htmlFor="pf-price">Selling price — per {unitShort(unit)} *</label>
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
                <label htmlFor="pf-qty">Initial quantity ({unitShort(unit)})</label>
                <input
                  id="pf-qty"
                  className="input"
                  type="number"
                  min="0"
                  step={qtyStep(unit)}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="pf-min">Minimum stock level ({unitShort(unit)}) *</label>
              <input
                id="pf-min"
                className="input"
                type="number"
                min="0"
                step={qtyStep(unit)}
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
