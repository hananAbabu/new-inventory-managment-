import { bankShort, payMethodLabel } from './banks';
import { userName } from './selectors';
import type { Db, Sale } from './types';
import { exportCSV, fd } from './utils';

export function exportSalesCsv(db: Db, list: Sale[]): void {
  exportCSV('sales-report.csv', [
    ['Ref', 'Date', 'Cashier', 'Lines', 'Method', 'Bank', 'Txn no.', 'Slip', 'Discount', 'Total'],
    ...list.map((s) => [
      s.ref,
      fd(s.createdAt),
      userName(db, s.cashierId),
      s.items.length,
      payMethodLabel(s.payMethod),
      s.bank ? bankShort(s.bank) : '',
      s.txnRef ?? '',
      s.txnPhoto ? 'yes' : '',
      s.discountPct + '%',
      s.total.toFixed(2),
    ]),
  ]);
}
