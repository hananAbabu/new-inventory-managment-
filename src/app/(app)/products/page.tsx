'use client';

import { useMemo, useState } from 'react';
import { ProductForm } from '@/components/forms/product-form';
import { Icon } from '@/components/icon';
import { useConfirm } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { Badge, EmptyState, Pager, SortTh, useSort, usePaged } from '@/components/ui';
import { describePackaging, typeLabel } from '@/lib/product-types';
import { catName, stockState, supName } from '@/lib/selectors';
import type { Product } from '@/lib/types';
import { formatQty, formatQtyNumber, unitShort } from '@/lib/units';
import { fdS } from '@/lib/utils';

type SortField = 'sku' | 'name' | 'price' | 'qty';

export default function ProductsPage() {
  const { db, update, money } = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [q, setQ] = useState('');
  const [cat, setCat] = useState(0);
  const [sup, setSup] = useState(0);
  const [lowOnly, setLowOnly] = useState(false);
  const { sort, dir, toggle } = useSort<SortField>('name');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const list = useMemo(() => {
    const filtered = db.products.filter(
      (p) =>
        (!q || (p.name + ' ' + p.sku).toLowerCase().includes(q.toLowerCase())) &&
        (!cat || p.categoryId === cat) &&
        (!sup || p.supplierId === sup) &&
        (!lowOnly || p.qty <= p.minStock),
    );
    const key = (p: Product): string | number =>
      sort === 'name'
        ? p.name.toLowerCase()
        : sort === 'qty'
          ? p.qty
          : sort === 'price'
            ? p.sellPrice
            : p.sku;
    return [...filtered].sort((a, b) => {
      const av = key(a);
      const bv = key(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }, [db.products, q, cat, sup, lowOnly, sort, dir]);

  const { rows, page, pages, setPage, total } = usePaged(list, 9);

  function openForm(product: Product | null) {
    setEditing(product);
    setFormOpen(true);
  }

  async function del(p: Product) {
    const ok = await confirm({
      title: 'Delete product',
      message: (
        <>
          Remove <b>{p.name}</b> ({p.sku}) from the catalog? Past sales history is preserved.
        </>
      ),
      danger: true,
      confirm: 'Delete',
    });
    if (!ok) return;
    update((draft, audit) => {
      draft.products = draft.products.filter((x) => x.id !== p.id);
      audit('PRODUCT', 'delete', `Deleted ${p.sku} — ${p.name}`);
    });
    toast('Product deleted');
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="grow" style={{ position: 'relative' }}>
          <input
            className="input"
            placeholder="Search name or SKU…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="select"
          style={{ width: '170px' }}
          value={cat}
          onChange={(e) => {
            setCat(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={0}>All categories</option>
          {db.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: '170px' }}
          value={sup}
          onChange={(e) => {
            setSup(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={0}>All suppliers</option>
          {db.suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className={`chip ${lowOnly ? 'on' : ''}`}
          onClick={() => {
            setLowOnly((v) => !v);
            setPage(1);
          }}
        >
          Low stock only
        </button>
        <button className="btn btn-primary" onClick={() => openForm(null)}>
          <Icon name="plus" /> Add product
        </button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <SortTh field="sku" label="SKU" sort={sort} dir={dir} onSort={toggle} />
              <SortTh field="name" label="Product" sort={sort} dir={dir} onSort={toggle} />
              <th>Configuration</th>
              <th>Supplier</th>
              <th className="num">Cost</th>
              <SortTh field="price" label="Price" sort={sort} dir={dir} onSort={toggle} className="num" />
              <th className="num">Stock</th>
              <SortTh field="qty" label="Status" sort={sort} dir={dir} onSort={toggle} />
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((p) => {
                const st = stockState(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.sku}</b>
                    </td>
                    <td>
                      <b>{p.name}</b>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {catName(db, p.categoryId)}
                      </div>
                    </td>
                    <td>
                      {p.productType === 'unset' ? (
                        <Badge tone="b-amber">Not configured</Badge>
                      ) : (
                        <>
                          {typeLabel(p.productType)}
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {describePackaging(p)}
                          </div>
                        </>
                      )}
                    </td>
                    <td>{supName(db, p.supplierId)}</td>
                    <td className="num">{money(p.costPrice)}</td>
                    <td className="num">
                      <b>{money(p.sellPrice)}</b>
                      <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                        per {unitShort(p.unit)}
                      </div>
                    </td>
                    <td className="num">
                      <b>{formatQty(p.qty, p.unit)}</b>{' '}
                      <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                        / min {formatQtyNumber(p.minStock)}
                      </span>
                    </td>
                    <td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td>{fdS(p.updatedAt)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="icon-btn sm" title="Edit" onClick={() => openForm(p)}>
                        <Icon name="pencil" />
                      </button>{' '}
                      <button className="icon-btn sm danger" title="Delete" onClick={() => del(p)}>
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10}>
                  <EmptyState
                    icon="tag"
                    title="No products match"
                    sub="Adjust filters or add a new product."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager total={total} page={page} pages={pages} onPage={setPage} />

      {formOpen ? (
        <ProductForm
          key={editing?.id ?? 'new'}
          open
          product={editing}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
    </div>
  );
}
