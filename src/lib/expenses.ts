import type { BadgeTone } from './selectors';
import type { ExpenseCategory } from './types';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; tone: BadgeTone }[] = [
  { value: 'rent', label: 'Rent', tone: 'b-violet' },
  { value: 'salary', label: 'Salary & wages', tone: 'b-blue' },
  { value: 'transport', label: 'Transport & freight', tone: 'b-amber' },
  { value: 'utilities', label: 'Utilities', tone: 'b-green' },
  { value: 'supplies', label: 'Store supplies', tone: 'b-gray' },
  { value: 'maintenance', label: 'Maintenance & repair', tone: 'b-gray' },
  { value: 'tax', label: 'Tax & licence', tone: 'b-red' },
  { value: 'other', label: 'Other', tone: 'b-gray' },
];

export function expenseCategoryLabel(c: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export function expenseCategoryTone(c: ExpenseCategory): BadgeTone {
  return EXPENSE_CATEGORIES.find((x) => x.value === c)?.tone ?? 'b-gray';
}
