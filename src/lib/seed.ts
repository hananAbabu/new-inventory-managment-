import { BANK_VALUES } from './banks';
import { packSize } from './product-types';
import type {
  Bank,
  Db,
  Expense,
  ExpenseCategory,
  PayMethod,
  Product,
  ProductType,
  PurchaseItem,
  SaleItem,
  Unit,
} from './types';
import { roundQty } from './units';
import { DAY, mulberry32, startOfDay, uid } from './utils';

type ProductSeed = [
  sku: string,
  name: string,
  categoryId: number,
  supplierId: number,
  productType: ProductType,
  unit: Unit,
  kgPerPiece: number | null,
  piecesPerCarton: number | null,
  cost: number,
  sell: number,
  qty: number,
  minStock: number,
];

type PurchaseSeed = [
  daysAgo: number,
  supplierId: number,
  /** [productId, packs, unit cost] — packs are converted to stock units on build. */
  lines: [number, number, number][],
  payMethod: PayMethod,
  bank: Bank | null,
];

type ExpenseSeed = [
  daysAgo: number,
  category: ExpenseCategory,
  description: string,
  amount: number,
  payMethod: PayMethod,
  bank: Bank | null,
];

/**
 * The catalogue, standardised on the four product configurations.
 *
 * Weight-based  — stocked and priced per kg, bought in sacks of a fixed weight.
 * Piece-based   — stocked and priced per piece.
 * Carton-based  — stocked and priced per carton; pieces per carton recorded.
 * Carton+piece  — bought by the carton, stocked and priced per piece.
 */
const PRODUCTS: ProductSeed[] = [
  // Weight-based: 1 sack = 50 kg
  ['SG-1001', 'Renuka Sugar', 1, 1, 'weight', 'kg', 50, null, 62, 68, 2000, 250],
  ['PA-2001', 'Mokoroni', 2, 3, 'weight', 'kg', 50, null, 48, 55, 1500, 200],
  // Weight-based: 1 sack = 15 kg
  ['PL-3001', 'Misir', 3, 3, 'weight', 'kg', 15, null, 95, 105, 450, 75],
  ['PL-3002', 'Difin Misir', 3, 3, 'weight', 'kg', 15, null, 88, 98, 45, 60],
  // Weight-based: 1 sack = 25 kg
  ['RC-4001', 'Rice', 4, 3, 'weight', 'kg', 25, null, 78, 86, 1250, 150],
  // Piece-based
  ['OL-5001', '20L Chife Oil', 5, 2, 'piece', 'pcs', null, null, 3100, 3350, 45, 10],
  // Carton-based
  ['OL-5002', '5L Chife Oil', 5, 2, 'carton', 'carton', null, 4, 3200, 3450, 60, 12],
  ['OL-5003', '3L Chife Oil', 5, 2, 'carton', 'carton', null, 6, 2850, 3080, 40, 10],
  ['PA-2002', 'OK Pasta', 2, 4, 'carton', 'carton', null, 20, 1150, 1260, 85, 20],
  ['DT-6001', 'Temer', 6, 4, 'carton', 'carton', null, null, 2400, 2650, 4, 6],
  // Carton with piece pricing: 4 × 5L pieces per carton
  ['OL-5004', 'Fesash', 5, 2, 'carton-piece', 'pcs', null, 4, 810, 875, 96, 24],
  ['OL-5005', 'Omar Sunflower Oil', 5, 2, 'carton-piece', 'pcs', null, 4, 845, 910, 72, 24],
  // Awaiting definition
  ['PL-3003', 'Bakela', 3, 3, 'unset', 'pcs', null, null, 72, 80, 60, 15],
];

const PURCHASES: PurchaseSeed[] = [
  [38, 1, [[1, 40, 62]], 'transfer', 'cbe'], // 40 sacks × 50 kg
  [31, 3, [[3, 30, 95], [4, 20, 88], [5, 50, 78]], 'transfer', 'awash'],
  [24, 2, [[7, 60, 3200], [8, 40, 2850]], 'transfer', 'coop'],
  [17, 4, [[9, 85, 1150], [10, 12, 2400]], 'cash', null],
  [10, 2, [[11, 24, 810], [12, 18, 845]], 'debit', 'boa'],
  [4, 3, [[2, 30, 48], [13, 60, 72]], 'transfer', 'check'],
];

const EXPENSES: ExpenseSeed[] = [
  [28, 'rent', 'Store rent — monthly', 12000, 'transfer', 'cbe'],
  [26, 'salary', 'Staff salaries', 15000, 'transfer', 'cbe'],
  [21, 'transport', 'Freight from Merkato warehouse', 3600, 'cash', null],
  [18, 'utilities', 'Electricity and water', 1450, 'debit', 'awash'],
  [12, 'supplies', 'Sacks, tape and packing material', 980, 'cash', null],
  [9, 'transport', 'Delivery fuel', 2200, 'cash', null],
  [5, 'maintenance', 'Weighing scale service', 1750, 'transfer', 'boa'],
  [2, 'tax', 'Municipal trade licence renewal', 3200, 'transfer', 'cbe'],
];

/** Sale sizes that suit the unit: kilos move in bulk, cartons a few at a time. */
function saleQtyFor(unit: Unit, R: () => number): number {
  if (unit === 'kg') return roundQty((1 + Math.floor(R() * 20)) * 5);
  if (unit === 'carton') return 1 + Math.floor(R() * 4);
  return 1 + Math.floor(R() * 6);
}

export function seed(): Db {
  const R = mulberry32(20260813);
  const now = Date.now();

  const db: Db = {
    settings: {
      shopName: 'Central Wholesale Store',
      currency: 'Br ',
      taxRate: 0,
      maxDiscount: 15,
      address: 'Merkato, Addis Ababa',
      phone: '+251 911 000 000',
      receiptFooter: 'Thank you for your business!',
    },
    users: [
      { id: 1, username: 'admin', password: 'admin123', name: 'Amelia Stone', role: 'admin', active: true, createdAt: now - 92 * DAY },
      { id: 2, username: 'keeper', password: 'keeper123', name: 'Marco Diaz', role: 'storekeeper', active: true, createdAt: now - 80 * DAY },
      { id: 3, username: 'cashier', password: 'cashier123', name: 'Nina Park', role: 'cashier', active: true, createdAt: now - 64 * DAY },
      { id: 4, username: 'tomi', password: 'cashier123', name: 'Tom Osei', role: 'cashier', active: true, createdAt: now - 51 * DAY },
    ],
    categories: [
      { id: 1, name: 'Sugar & Sweeteners', description: 'Sugar sold by weight' },
      { id: 2, name: 'Pasta & Macaroni', description: 'Macaroni by weight and pasta by carton' },
      { id: 3, name: 'Pulses & Legumes', description: 'Lentils, beans and pulses' },
      { id: 4, name: 'Rice & Cereals', description: 'Rice and cereal grains' },
      { id: 5, name: 'Edible Oils', description: 'Cooking oil in jerrycans and cartons' },
      { id: 6, name: 'Dates & Dried Fruit', description: 'Dates and dried produce' },
    ],
    suppliers: [
      { id: 1, name: 'Renuka Distribution PLC', contact: 'Selam Bekele', phone: '+251 911 224 466', email: 'orders@renukadist.et', address: 'Kality Industrial Area', createdAt: now - 88 * DAY },
      { id: 2, name: 'Chife Oil Import & Trading', contact: 'Yonas Girma', phone: '+251 911 553 210', email: 'sales@chifeoil.et', address: 'Lebu Warehouse 12', createdAt: now - 76 * DAY },
      { id: 3, name: 'Addis Grain & Pulses Traders', contact: 'Hanna Tesfaye', phone: '+251 911 778 940', email: 'hanna@addisgrain.et', address: 'Merkato Grain Terminal', createdAt: now - 70 * DAY },
      { id: 4, name: 'Merkato Dry Goods Wholesale', contact: 'Omar Haddad', phone: '+251 911 336 128', email: 'omar@merkatodry.et', address: 'Merkato Block 4', createdAt: now - 65 * DAY },
    ],
    products: [],
    sales: [],
    purchases: [],
    payments: [],
    expenses: [],
    invTx: [],
    audit: [
      { id: 1, date: now - 60 * DAY, userId: 1, group: 'SYSTEM', action: 'init', detail: 'Workspace initialised' },
    ],
  };

  PRODUCTS.forEach((p, i) => {
    db.products.push({
      id: i + 1,
      sku: p[0],
      name: p[1],
      categoryId: p[2],
      supplierId: p[3],
      productType: p[4],
      unit: p[5],
      kgPerPiece: p[6],
      piecesPerCarton: p[7],
      costPrice: p[8],
      sellPrice: p[9],
      qty: p[10],
      minStock: p[11],
      createdAt: now - 60 * DAY,
      updatedAt: now - Math.floor(R() * 20) * DAY,
    });
    db.invTx.push({
      id: uid(db.invTx),
      date: now - 60 * DAY + i * 3_600_000,
      productId: i + 1,
      sku: p[0],
      name: p[1],
      unit: p[5],
      type: 'initial',
      qty: p[10],
      userId: 1,
      note: 'Opening stock',
    });
  });

  const byId = (id: number): Product => db.products.find((x) => x.id === id)!;

  PURCHASES.forEach((pp, i) => {
    const items: PurchaseItem[] = pp[2].map(([productId, packs, cost]) => {
      const pr = byId(productId);
      return {
        productId,
        sku: pr.sku,
        name: pr.name,
        unit: pr.unit,
        qty: roundQty(packs * packSize(pr)),
        cost,
      };
    });
    const total = items.reduce((a, b) => a + b.qty * b.cost, 0);
    const dt = now - pp[0] * DAY + 10 * 3_600_000;
    const pur = {
      id: i + 1,
      ref: 'P-' + String(i + 1).padStart(5, '0'),
      supplierId: pp[1],
      byUserId: 2,
      items,
      total,
      status: 'received' as const,
      payMethod: pp[3],
      bank: pp[4],
      createdAt: dt,
      receivedAt: dt + 3_600_000,
    };
    db.purchases.push(pur);
    items.forEach((it) =>
      db.invTx.push({
        id: uid(db.invTx),
        date: dt + 3_600_000,
        productId: it.productId,
        sku: it.sku,
        name: it.name,
        unit: it.unit,
        type: 'purchase',
        qty: it.qty,
        userId: 2,
        note: 'Purchase ' + pur.ref,
      }),
    );
  });

  // One order still on its way, so the Receive flow has something to act on.
  const pendingSugar = byId(1);
  db.purchases.push({
    id: 7,
    ref: 'P-00007',
    supplierId: 1,
    byUserId: 2,
    items: [
      {
        productId: pendingSugar.id,
        sku: pendingSugar.sku,
        name: pendingSugar.name,
        unit: pendingSugar.unit,
        qty: roundQty(20 * packSize(pendingSugar)),
        cost: 62,
      },
    ],
    total: roundQty(20 * packSize(pendingSugar)) * 62,
    status: 'ordered',
    payMethod: 'transfer',
    bank: 'dashen',
    createdAt: now - 2 * DAY,
    receivedAt: null,
  });

  EXPENSES.forEach((e, i) => {
    const expense: Expense = {
      id: i + 1,
      ref: 'E-' + String(i + 1).padStart(5, '0'),
      date: startOfDay(now) - e[0] * DAY + 11 * 3_600_000,
      category: e[1],
      description: e[2],
      amount: e[3],
      payMethod: e[4],
      bank: e[5],
      txnRef: e[5] ? 'FT' + String(Math.floor(R() * 9_000_000) + 1_000_000) : null,
      byUserId: 1,
      createdAt: startOfDay(now) - e[0] * DAY + 11 * 3_600_000,
    };
    db.expenses.push(expense);
  });

  let saleN = 0;
  for (let d = 30; d >= 0; d--) {
    const base = startOfDay(now) - d * DAY;
    const count = d === 0 ? 3 : Math.floor(R() * 3) + (d % 7 === 5 || d % 7 === 6 ? 3 : 1);
    for (let s = 0; s < count; s++) {
      saleN++;
      let ts = base + (9 + Math.floor(R() * 11)) * 3_600_000 + Math.floor(R() * 3_500_000);
      if (ts > now - 300_000) ts = now - 300_000 - Math.floor(R() * 4 * 3_600_000);
      const cashier = R() < 0.6 ? 3 : 4;
      const nIt = 1 + Math.floor(R() * 3);
      const items: SaleItem[] = [];
      const pool = [...db.products];
      for (let k = 0; k < nIt && pool.length; k++) {
        const pr = pool.splice(Math.floor(R() * pool.length), 1)[0];
        items.push({
          productId: pr.id,
          sku: pr.sku,
          name: pr.name,
          unit: pr.unit,
          price: pr.sellPrice,
          cost: pr.costPrice,
          qty: saleQtyFor(pr.unit, R),
        });
      }
      const subtotal = items.reduce((a, b) => a + b.price * b.qty, 0);
      const discountPct = R() < 0.25 ? (R() < 0.5 ? 5 : 10) : 0;
      const discount = (subtotal * discountPct) / 100;
      const total = subtotal - discount;
      const method: PayMethod = R() < 0.5 ? 'cash' : R() < 0.7 ? 'transfer' : 'debit';
      const bank: Bank | null =
        method === 'cash' ? null : BANK_VALUES[Math.floor(R() * BANK_VALUES.length)];
      const paid =
        method === 'cash'
          ? R() < 0.5
            ? Math.ceil(total / 5) * 5
            : Math.ceil(total)
          : total;
      const sale = {
        id: saleN,
        ref: 'S-' + String(saleN).padStart(5, '0'),
        cashierId: cashier,
        items,
        subtotal,
        discountPct,
        discount,
        tax: 0,
        total,
        payMethod: method,
        bank,
        txnRef: bank ? 'FT' + String(Math.floor(R() * 9_000_000) + 1_000_000) : null,
        txnPhoto: null,
        amountPaid: paid,
        change: Math.max(0, paid - total),
        createdAt: ts,
      };
      db.sales.push(sale);
      db.payments.push({
        id: uid(db.payments),
        saleId: sale.id,
        method,
        bank,
        amount: paid,
        createdAt: ts,
      });
      items.forEach((it) =>
        db.invTx.push({
          id: uid(db.invTx),
          date: ts,
          productId: it.productId,
          sku: it.sku,
          name: it.name,
          unit: it.unit,
          type: 'sale',
          qty: -it.qty,
          userId: cashier,
          note: 'Sale ' + sale.ref,
        }),
      );
    }
  }

  return db;
}
