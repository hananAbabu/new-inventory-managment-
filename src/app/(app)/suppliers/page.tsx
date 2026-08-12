'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter, useConfirm } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import type { Supplier } from '@/lib/types';
import { uid } from '@/lib/utils';

export default function SuppliersPage() {
  const { db, update } = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  function openForm(s: Supplier | null) {
    setEditing(s);
    setFormOpen(true);
  }

  async function del(s: Supplier) {
    if (db.purchases.some((p) => p.supplierId === s.id)) {
      toast('Cannot delete — purchase history exists for this supplier', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Delete supplier',
      message: (
        <>
          Delete <b>{s.name}</b>? Products linked to it will have no supplier.
        </>
      ),
      danger: true,
      confirm: 'Delete',
    });
    if (!ok) return;
    update((draft, audit) => {
      draft.suppliers = draft.suppliers.filter((x) => x.id !== s.id);
      draft.products.forEach((p) => {
        if (p.supplierId === s.id) p.supplierId = null;
      });
      audit('SUPPLIER', 'delete', 'Deleted supplier ' + s.name);
    });
    toast('Supplier deleted');
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>Suppliers</h3>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => openForm(null)}>
          <Icon name="plus" /> Add supplier
        </button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Contact</th>
              <th>Phone / Email</th>
              <th className="num">Products</th>
              <th className="num">Purchases</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.suppliers.map((s) => (
              <tr key={s.id}>
                <td>
                  <b>{s.name}</b>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{s.address}</div>
                </td>
                <td>{s.contact || '—'}</td>
                <td style={{ fontSize: '12px' }}>
                  {s.phone}
                  <br />
                  <span style={{ color: 'var(--muted)' }}>{s.email}</span>
                </td>
                <td className="num">{db.products.filter((p) => p.supplierId === s.id).length}</td>
                <td className="num">{db.purchases.filter((p) => p.supplierId === s.id).length}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="icon-btn sm" onClick={() => openForm(s)} title="Edit">
                    <Icon name="pencil" />
                  </button>{' '}
                  <button className="icon-btn sm danger" onClick={() => del(s)} title="Delete">
                    <Icon name="trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen ? (
        <SupplierForm
          key={editing?.id ?? 'new'}
          supplier={editing}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
    </div>
  );
}

function SupplierForm({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();

  const [name, setName] = useState(supplier?.name ?? '');
  const [contact, setContact] = useState(supplier?.contact ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nameV = name.trim();
    if (!nameV) {
      toast('Name required', 'error');
      return;
    }
    if (db.suppliers.some((s) => s.name.toLowerCase() === nameV.toLowerCase() && s.id !== supplier?.id)) {
      toast('Supplier already exists', 'error');
      return;
    }
    const data = {
      name: nameV,
      contact: contact.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
    };
    update((draft, audit) => {
      if (supplier) {
        const s = draft.suppliers.find((x) => x.id === supplier.id);
        if (!s) return;
        Object.assign(s, data);
        audit('SUPPLIER', 'edit', 'Updated supplier ' + nameV);
      } else {
        draft.suppliers.push({ id: uid(draft.suppliers), ...data, createdAt: Date.now() });
        audit('SUPPLIER', 'add', 'Added supplier ' + nameV);
      }
    });
    toast('Supplier saved');
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={supplier ? 'Edit supplier' : 'Add supplier'}>
      <form onSubmit={onSubmit}>
        <ModalBody>
          <div className="field">
            <label htmlFor="sf-name">Company name *</label>
            <input
              id="sf-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="field">
              <label htmlFor="sf-contact">Contact person</label>
              <input
                id="sf-contact"
                className="input"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sf-phone">Phone</label>
              <input
                id="sf-phone"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="sf-email">Email</label>
            <input
              id="sf-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="sf-address">Address</label>
            <input
              id="sf-address"
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            <Icon name="check" /> Save
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
