'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter, useConfirm } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { SCHEMA_SQL } from '@/lib/schema-sql';

export default function SettingsPage() {
  const { db, update, resetDemoData } = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const s = db.settings;

  const [shopName, setShopName] = useState(s.shopName);
  const [currency, setCurrency] = useState(s.currency);
  const [taxRate, setTaxRate] = useState(String(s.taxRate));
  const [maxDiscount, setMaxDiscount] = useState(String(s.maxDiscount));
  const [phone, setPhone] = useState(s.phone);
  const [address, setAddress] = useState(s.address);
  const [receiptFooter, setReceiptFooter] = useState(s.receiptFooter);
  const [schemaOpen, setSchemaOpen] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const tax = parseFloat(taxRate) || 0;
    const disc = parseInt(maxDiscount, 10);
    if (tax < 0 || tax > 30) {
      toast('Tax rate must be between 0 and 30', 'error');
      return;
    }
    if (isNaN(disc) || disc < 0 || disc > 100) {
      toast('Max discount must be 0–100', 'error');
      return;
    }
    update((draft, audit) => {
      const st = draft.settings;
      st.shopName = shopName.trim() || st.shopName;
      st.currency = currency || '$';
      st.taxRate = tax;
      st.maxDiscount = disc;
      st.phone = phone.trim();
      st.address = address.trim();
      st.receiptFooter = receiptFooter.trim();
      audit('SETTINGS', 'update', 'Updated system settings');
    });
    toast('Settings saved');
  }

  async function onReset() {
    const ok = await confirm({
      title: 'Reset demo data',
      message:
        'This wipes every change and regenerates the original demo dataset. Continue?',
      danger: true,
      confirm: 'Reset everything',
    });
    if (!ok) return;
    resetDemoData();
    toast('Demo data has been reset', 'info');
  }

  return (
    <div className="grid two-col">
      <div className="card">
        <div className="card-h">
          <h3>Shop configuration</h3>
        </div>
        <div className="card-b">
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="st-name">Shop name *</label>
              <input
                id="st-name"
                className="input"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
              />
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
              <div className="field">
                <label htmlFor="st-cur">Currency symbol</label>
                <input
                  id="st-cur"
                  className="input"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="st-tax">Tax rate %</label>
                <input
                  id="st-tax"
                  className="input"
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="st-disc">Max cashier discount %</label>
                <input
                  id="st-disc"
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="st-phone">Phone</label>
                <input
                  id="st-phone"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="st-addr">Address</label>
              <input
                id="st-addr"
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="st-foot">Receipt footer message</label>
              <input
                id="st-foot"
                className="input"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
              />
            </div>

            <button className="btn btn-primary" type="submit">
              <Icon name="check" /> Save settings
            </button>
          </form>
        </div>
      </div>

      <div>
        <div className="card">
          <div className="card-h">
            <h3>Relational schema</h3>
            <button
              className="btn btn-ghost"
              style={{ marginLeft: 'auto' }}
              onClick={() => setSchemaOpen(true)}
            >
              <Icon name="eye" /> View SQL
            </button>
          </div>
          <div className="card-b" style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
            The demo store mirrors a normalised relational model:{' '}
            <b>
              users, roles, products, categories, suppliers, purchases, purchase_items, sales,
              sale_items, payments, inventory_transactions
            </b>{' '}
            — with PKs, FKs and timestamps.
          </div>
        </div>

        <div className="card" style={{ marginTop: '16px', borderColor: '#f2c8c1' }}>
          <div className="card-h">
            <h3 style={{ color: 'var(--danger)' }}>Danger zone</h3>
          </div>
          <div className="card-b">
            <p style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: '12px' }}>
              Restore the original demo dataset. All changes you made will be lost.
            </p>
            <button className="btn btn-danger" onClick={onReset}>
              <Icon name="trash" /> Reset demo data
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={schemaOpen}
        onClose={() => setSchemaOpen(false)}
        size="lg"
        title="Database schema (SQL)"
      >
        <ModalBody>
          <pre className="sql">{SCHEMA_SQL}</pre>
        </ModalBody>
        <ModalFooter>
          <button className="btn btn-primary" onClick={() => setSchemaOpen(false)}>
            Close
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
