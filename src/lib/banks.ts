import type { Bank, PayMethod } from './types';

export const BANKS: { value: Bank; label: string; short: string }[] = [
  { value: 'cbe', label: 'Commercial Bank of Ethiopia', short: 'CBE' },
  { value: 'boa', label: 'Bank of Abyssinia', short: 'BOA' },
  { value: 'awash', label: 'Awash Bank', short: 'Awash' },
  { value: 'dashen', label: 'Dashen Bank', short: 'Dashen' },
  { value: 'coop', label: 'Cooperative Bank of Oromia', short: 'Coop' },
  { value: 'oromiya', label: 'Oromia Bank', short: 'Oromiya' },
  { value: 'shebele', label: 'Shabelle Bank', short: 'Shebele' },
  { value: 'check', label: 'Check / Cheque', short: 'Check' },
];

export const BANK_VALUES: Bank[] = BANKS.map((b) => b.value);

export function bankLabel(b: Bank | null | undefined): string {
  if (!b) return '—';
  return BANKS.find((x) => x.value === b)?.label ?? b;
}

export function bankShort(b: Bank | null | undefined): string {
  if (!b) return '—';
  return BANKS.find((x) => x.value === b)?.short ?? b;
}

export const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'credit', label: 'Credit' },
];

export function payMethodLabel(m: PayMethod): string {
  return PAY_METHODS.find((x) => x.value === m)?.label ?? m;
}

/** Only a transfer clears through a bank; cash and credit do not. */
export function needsBank(m: PayMethod): boolean {
  return m === 'transfer';
}

/**
 * Credit, or anything short-paid, leaves a balance owing, and a balance has to be
 * attached to a named customer or nobody knows who to collect from.
 */
export function requiresCustomer(method: PayMethod, paid: number, total: number): boolean {
  return method === 'credit' || paid + 0.001 < total;
}
