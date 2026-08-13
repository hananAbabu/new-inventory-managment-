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
  { value: 'debit', label: 'Debit' },
];

export function payMethodLabel(m: PayMethod): string {
  return PAY_METHODS.find((x) => x.value === m)?.label ?? m;
}

/** Cash never touches a bank; transfer and debit always name one. */
export function needsBank(m: PayMethod): boolean {
  return m !== 'cash';
}
