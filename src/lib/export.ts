import { userName } from './selectors';
import type { Db, Sale } from './types';
import { exportCSV, fd } from './utils';

export function exportSalesCsv(db: Db, list: Sale[]): void {
  exportCSV('sales-report.csv', [
    ['Ref', 'Date', 'Cashier', 'Items', 'Method', 'Discount', 'Total'],
    ...list.map((s) => [
      s.ref,
      fd(s.createdAt),
      userName(db, s.cashierId),
      s.items.reduce((a, i) => a + i.qty, 0),
      s.payMethod,
      s.discountPct + '%',
      s.total.toFixed(2),
    ]),
  ]);
}
