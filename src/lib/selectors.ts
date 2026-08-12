import type { Db, Product, TxType } from './types';

export function money(currency: string, n: number | undefined | null): string {
  const v = Number(n || 0);
  return (
    (v < 0 ? '-' : '') +
    currency +
    Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function userName(db: Db, id: number | null): string {
  const u = db.users.find((x) => x.id === id);
  return u ? u.name : '—';
}

export function catName(db: Db, id: number | null): string {
  const c = db.categories.find((x) => x.id === id);
  return c ? c.name : '—';
}

export function supName(db: Db, id: number | null): string {
  const s = db.suppliers.find((x) => x.id === id);
  return s ? s.name : '—';
}

export function lowStock(db: Db): Product[] {
  return db.products.filter((p) => p.qty <= p.minStock);
}

export function inventoryValue(db: Db): number {
  return db.products.reduce((a, p) => a + p.qty * p.costPrice, 0);
}

export function retailValue(db: Db): number {
  return db.products.reduce((a, p) => a + p.qty * p.sellPrice, 0);
}

export function unitsOnHand(db: Db): number {
  return db.products.reduce((a, p) => a + p.qty, 0);
}

export type BadgeTone =
  | 'b-green'
  | 'b-amber'
  | 'b-red'
  | 'b-blue'
  | 'b-gray'
  | 'b-violet';

export function stockState(p: Product): { tone: BadgeTone; label: string } {
  if (p.qty <= 0) return { tone: 'b-red', label: 'Out of stock' };
  if (p.qty <= p.minStock) return { tone: 'b-amber', label: 'Low stock' };
  return { tone: 'b-green', label: 'In stock' };
}

const TX_BADGES: Record<TxType, [BadgeTone, string]> = {
  purchase: ['b-green', 'Received'],
  sale: ['b-blue', 'Sold'],
  received: ['b-green', 'Received'],
  damage: ['b-amber', 'Damaged'],
  lost: ['b-red', 'Lost'],
  adjustment: ['b-gray', 'Adjusted'],
  initial: ['b-gray', 'Initial'],
};

export function txBadge(t: TxType): { tone: BadgeTone; label: string } {
  const [tone, label] = TX_BADGES[t] ?? (['b-gray', t] as [BadgeTone, string]);
  return { tone, label };
}
