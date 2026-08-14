import type { Product, ProductType, Unit } from './types';
import { formatQtyNumber, unitShort } from './units';

/**
 * The four standard product configurations, plus 'unset' for a product whose
 * packaging has not been decided yet.
 *
 * Each configuration fixes three things: the unit stock is counted in, the unit
 * prices are quoted in (always the same unit), and how an incoming pack from the
 * supplier converts into stock units.
 */

interface ProductTypeDef {
  value: ProductType;
  label: string;
  /** Unit stock and prices use. Null means the product still chooses freely. */
  stockUnit: Unit | null;
  /** What one supplier pack is called, when a pack differs from the stock unit. */
  packNoun: string | null;
  needsKgPerPiece: boolean;
  needsPiecesPerCarton: boolean;
  hint: string;
}

export const PRODUCT_TYPES: ProductTypeDef[] = [
  {
    value: 'weight',
    label: 'Weight-based',
    stockUnit: 'kg',
    packNoun: 'sack',
    needsKgPerPiece: true,
    needsPiecesPerCarton: false,
    hint: 'Stocked and priced per kg; bought in sacks of a fixed weight.',
  },
  {
    value: 'piece',
    label: 'Piece-based',
    stockUnit: 'pcs',
    packNoun: null,
    needsKgPerPiece: false,
    needsPiecesPerCarton: false,
    hint: 'Stocked and priced per piece, with no packaging conversion.',
  },
  {
    value: 'carton',
    label: 'Carton-based',
    stockUnit: 'carton',
    packNoun: null,
    needsKgPerPiece: false,
    needsPiecesPerCarton: true,
    hint: 'Stocked and priced per carton; the pieces per carton are recorded for reference.',
  },
  {
    value: 'carton-piece',
    label: 'Carton with piece pricing',
    stockUnit: 'pcs',
    packNoun: 'carton',
    needsKgPerPiece: false,
    needsPiecesPerCarton: true,
    hint: 'Bought by the carton, stocked and priced per piece.',
  },
  {
    value: 'unset',
    label: 'Not configured yet',
    stockUnit: null,
    packNoun: null,
    needsKgPerPiece: false,
    needsPiecesPerCarton: false,
    hint: 'Measurement and packaging still to be defined — choose the unit manually for now.',
  },
];

const DEFS: Record<ProductType, ProductTypeDef> = Object.fromEntries(
  PRODUCT_TYPES.map((t) => [t.value, t]),
) as Record<ProductType, ProductTypeDef>;

export function typeDef(t: ProductType): ProductTypeDef {
  return DEFS[t] ?? DEFS.unset;
}

export function typeLabel(t: ProductType): string {
  return typeDef(t).label;
}

/** The unit a configured type forces, or null when the product picks its own. */
export function stockUnitFor(t: ProductType): Unit | null {
  return typeDef(t).stockUnit;
}

/** The packaging fields a type needs filled in. */
export function needsKgPerPiece(t: ProductType): boolean {
  return typeDef(t).needsKgPerPiece;
}

export function needsPiecesPerCarton(t: ProductType): boolean {
  return typeDef(t).needsPiecesPerCarton;
}

type Packable = Pick<Product, 'productType' | 'unit' | 'kgPerPiece' | 'piecesPerCarton'>;

/**
 * How many stock units one supplier pack contains: 50 kg in a sack of sugar,
 * 4 pieces in a carton of Omar Sunflower Oil, 1 when the pack is the stock unit.
 */
export function packSize(p: Packable): number {
  if (p.productType === 'weight') return p.kgPerPiece && p.kgPerPiece > 0 ? p.kgPerPiece : 1;
  if (p.productType === 'carton-piece')
    return p.piecesPerCarton && p.piecesPerCarton > 0 ? p.piecesPerCarton : 1;
  return 1;
}

/** What one pack is called, or null when purchases are entered in stock units. */
export function packNoun(p: Packable): string | null {
  return packSize(p) > 1 ? typeDef(p.productType).packNoun : null;
}

/** "1 sack = 50 kg", "4 pcs / carton" — the packaging rule in words. */
export function describePackaging(p: Packable): string {
  switch (p.productType) {
    case 'weight':
      return p.kgPerPiece ? `1 sack = ${formatQtyNumber(p.kgPerPiece)} kg` : 'sack weight not set';
    case 'carton':
      return p.piecesPerCarton
        ? `${formatQtyNumber(p.piecesPerCarton)} pcs / carton`
        : 'pieces per carton not set';
    case 'carton-piece':
      return p.piecesPerCarton
        ? `1 carton = ${formatQtyNumber(p.piecesPerCarton)} pcs`
        : 'pieces per carton not set';
    case 'piece':
      return 'sold as single pieces';
    default:
      return 'packaging not defined';
  }
}

/** "per kg", "per carton" — how this product's prices are quoted. */
export function priceUnitLabel(p: Pick<Product, 'unit'>): string {
  return `per ${unitShort(p.unit)}`;
}
