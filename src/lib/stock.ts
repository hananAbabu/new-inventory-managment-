import type { Product, StockLocation } from './types';

/**
 * Stock is counted in two places: the store (warehouse) and the shop (counter).
 * Every purchase, sale and movement names the location it went through, and the
 * product's `qty` is the database-computed total of the two.
 */

export const STOCK_LOCATIONS: { value: StockLocation; label: string; hint: string }[] = [
  { value: 'store', label: 'Store', hint: 'Back store / warehouse' },
  { value: 'shop', label: 'Shop', hint: 'Counter / shop floor' },
];

export const STOCK_LOCATION_LABELS: Record<StockLocation, string> = {
  store: 'Store',
  shop: 'Shop',
};

export function stockLocationLabel(l: StockLocation): string {
  return STOCK_LOCATION_LABELS[l] ?? l;
}

/** Stock held at one location. */
export function stockAt(
  p: Pick<Product, 'qtyStore' | 'qtyShop'>,
  location: StockLocation,
): number {
  return location === 'shop' ? p.qtyShop : p.qtyStore;
}

/** The other side, for transfers. */
export function otherLocation(l: StockLocation): StockLocation {
  return l === 'store' ? 'shop' : 'store';
}
