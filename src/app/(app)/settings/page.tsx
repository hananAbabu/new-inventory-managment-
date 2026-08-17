'use client';

import { useState, type FormEvent } from 'react';
import { updateSettings } from '@/app/actions/admin';
import { Icon } from '@/components/icon';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';

export default function SettingsPage() {
  const { db, run } = useStore();
  const toast = useToast();
  const s = db.settings;

  const [shopName, setShopName] = useState(s.shopName);
  const [currency, setCurrency] = useState(s.currency);
  const [taxRate, setTaxRate] = useState(String(s.taxRate));
  const [maxDiscount, setMaxDiscount] = useState(String(s.maxDiscount));
  const [phone, setPhone] = useState(s.phone);
  const [address, setAddress] = useState(s.address);
  const [receiptFooter, setReceiptFooter] = useState(s.receiptFooter);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
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
    setBusy(true);
    const ok = await run(() =>
      updateSettings({
        shopName,
        currency,
        taxRate: tax,
        maxDiscount: disc,
        phone,
        address,
        receiptFooter,
      }),
    );
    setBusy(false);
    if (ok) toast('Settings saved');
  }

  return (
    <div className="grid" style={{ maxWidth: '620px' }}>
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

            <button className="btn btn-primary" type="submit" disabled={busy}>
              <Icon name="check" /> Save settings
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
