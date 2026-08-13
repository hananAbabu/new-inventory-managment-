import type { Unit } from './types';

interface UnitDef {
  value: Unit;
  /** Shown next to a number: "12 kg". */
  short: string;
  /** Shown in dropdowns. */
  label: string;
  /** Weight and volume are measured, so they accept fractions. */
  fractional: boolean;
}

export const UNITS: UnitDef[] = [
  { value: 'pcs', short: 'pcs', label: 'Pieces (pcs)', fractional: false },
  { value: 'carton', short: 'ctn', label: 'Carton (ctn)', fractional: false },
  { value: 'kg', short: 'kg', label: 'Kilogram (kg)', fractional: true },
  { value: 'l', short: 'L', label: 'Litre (L)', fractional: true },
];

const DEFS: Record<Unit, UnitDef> = Object.fromEntries(
  UNITS.map((u) => [u.value, u]),
) as Record<Unit, UnitDef>;

export function unitShort(u: Unit): string {
  return DEFS[u]?.short ?? u;
}

export function unitLabel(u: Unit): string {
  return DEFS[u]?.label ?? u;
}

/** True for units that can be split — kg and litre, not pieces or cartons. */
export function isFractional(u: Unit): boolean {
  return DEFS[u]?.fractional ?? false;
}

/** Input step: whole numbers for countable units, hundredths for measured ones. */
export function qtyStep(u: Unit): string {
  return isFractional(u) ? '0.01' : '1';
}

/** Smallest quantity a line can hold. */
export function qtyMin(u: Unit): number {
  return isFractional(u) ? 0.01 : 1;
}

/** Kills float drift from repeated kg/litre arithmetic. */
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Parses user input against the unit's precision. NaN stays NaN for the caller to reject. */
export function parseQty(value: string, u: Unit): number {
  const n = isFractional(u) ? parseFloat(value) : parseInt(value, 10);
  return isNaN(n) ? NaN : roundQty(n);
}

/** "12 kg", "3 pcs" — trailing zeros trimmed. */
export function formatQty(n: number, u: Unit): string {
  return `${formatQtyNumber(n)} ${unitShort(u)}`;
}

/** The bare number, without the unit suffix. */
export function formatQtyNumber(n: number): string {
  return String(roundQty(n));
}
