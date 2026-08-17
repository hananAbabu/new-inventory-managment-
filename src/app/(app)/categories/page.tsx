'use client';

import { useState, type FormEvent } from 'react';
import { deleteCategory, saveCategory } from '@/app/actions/catalog';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter, useConfirm } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import type { Category } from '@/lib/types';

export default function CategoriesPage() {
  const { db, run } = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  function openForm(c: Category | null) {
    setEditing(c);
    setFormOpen(true);
  }

  async function del(c: Category) {
    if (db.products.some((p) => p.categoryId === c.id)) {
      toast('Cannot delete — products are assigned to this category', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Delete category',
      message: (
        <>
          Delete <b>{c.name}</b>?
        </>
      ),
      danger: true,
      confirm: 'Delete',
    });
    if (!ok) return;
    if (await run(() => deleteCategory(c.id))) toast('Category deleted');
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>Product categories</h3>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => openForm(null)}>
          <Icon name="plus" /> Add category
        </button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Category</th>
              <th>Description</th>
              <th className="num">Products</th>
              <th className="num">Units</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.categories.map((c) => {
              const ps = db.products.filter((p) => p.categoryId === c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{c.description || '—'}</td>
                  <td className="num">{ps.length}</td>
                  <td className="num">{ps.reduce((a, p) => a + p.qty, 0)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-btn sm" onClick={() => openForm(c)} title="Edit">
                      <Icon name="pencil" />
                    </button>{' '}
                    <button className="icon-btn sm danger" onClick={() => del(c)} title="Delete">
                      <Icon name="trash" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {formOpen ? (
        <CategoryForm
          key={editing?.id ?? 'new'}
          category={editing}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { db, run } = useStore();
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nameV = name.trim();
    if (!nameV) {
      toast('Name required', 'error');
      return;
    }
    if (db.categories.some((c) => c.name.toLowerCase() === nameV.toLowerCase() && c.id !== category?.id)) {
      toast('Category already exists', 'error');
      return;
    }
    setBusy(true);
    const ok = await run(() => saveCategory(category?.id ?? null, nameV, description));
    setBusy(false);
    if (!ok) return;
    toast('Category saved');
    onClose();
  }

  return (
    <Modal open onClose={onClose} size="sm" title={category ? 'Edit category' : 'Add category'}>
      <form onSubmit={onSubmit}>
        <ModalBody>
          <div className="field">
            <label htmlFor="cf-name">Name *</label>
            <input
              id="cf-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cf-desc">Description</label>
            <input
              id="cf-desc"
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Icon name="check" /> Save
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
