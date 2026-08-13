import { BANK_VALUES } from './banks';
import type { Bank, Db, PayMethod, Product, PurchaseItem, SaleItem, Unit } from './types';
import { DAY, mulberry32, startOfDay, uid } from './utils';

type ProductSeed = [
  sku: string,
  name: string,
  categoryId: number,
  supplierId: number,
  unit: Unit,
  cost: number,
  sell: number,
  qty: number,
  minStock: number,
];

type PurchaseSeed = [
  daysAgo: number,
  supplierId: number,
  lines: [number, number, number][],
  payMethod: PayMethod,
  bank: Bank | null,
];

const PRODUCTS: ProductSeed[] = [
  ['TS-1001', 'Classic Logo Tee', 1, 1, 'pcs', 6.5, 14.99, 42, 10],
  ['TS-1002', 'Vintage Graphic Tee', 1, 1, 'pcs', 7.25, 16.5, 8, 10],
  ['HD-1101', 'Fleece Pullover Hoodie', 1, 1, 'pcs', 14, 32, 18, 6],
  ['MG-2001', 'Ceramic Shop Mug', 2, 2, 'pcs', 2.8, 8.99, 60, 15],
  ['MG-2002', 'Enamel Camp Mug', 2, 2, 'pcs', 3.6, 11.5, 12, 12],
  ['BT-9001', 'Steel Water Bottle 500ml', 2, 2, 'pcs', 4.8, 13.5, 32, 10],
  ['TT-3001', 'Canvas Tote Bag', 3, 3, 'pcs', 2.2, 7.99, 55, 12],
  ['TT-3002', 'Insulated Lunch Tote', 3, 3, 'pcs', 5.4, 14, 20, 8],
  ['CP-4001', 'Snapback Cap', 4, 3, 'pcs', 3.9, 12, 26, 10],
  ['CP-4002', 'Knit Beanie', 4, 3, 'pcs', 3.1, 9.5, 6, 8],
  ['ST-5001', 'Dot-Grid Notebook A5', 5, 4, 'pcs', 1.9, 5.99, 70, 20],
  ['ST-5002', 'Gel Pen Set (5-pack)', 5, 4, 'pcs', 1.2, 3.99, 90, 25],
  ['KC-6001', 'Acrylic Keychain', 6, 4, 'pcs', 0.8, 3.5, 110, 30],
  ['KC-6002', 'Bottle-Opener Keyring', 6, 4, 'pcs', 1.1, 4.25, 14, 15],
  ['SK-7001', 'Sticker Pack (12 pcs)', 7, 2, 'carton', 0.95, 3.25, 140, 40],
  ['PT-7002', 'Art Print A4', 7, 2, 'pcs', 1.6, 6, 30, 10],
  ['HL-8001', 'Scented Soy Candle', 8, 4, 'pcs', 3.2, 9.99, 24, 8],
  ['HL-8002', 'Ceramic Coaster Set', 8, 4, 'pcs', 2.7, 8.5, 9, 10],
  ['RW-9101', 'Cotton Fabric Roll', 1, 1, 'kg', 4.4, 11.5, 36.5, 12],
  ['RW-9102', 'Candle Wax Base', 8, 4, 'l', 2.6, 7.25, 18.75, 10],
];

const PURCHASES: PurchaseSeed[] = [
  [42, 1, [[1, 40, 6.5], [3, 15, 14]], 'transfer', 'cbe'],
  [33, 2, [[4, 48, 2.8], [15, 100, 0.95], [16, 25, 1.6]], 'transfer', 'awash'],
  [26, 3, [[7, 40, 2.2], [9, 20, 3.9], [10, 15, 3.1]], 'cash', null],
  [18, 4, [[11, 60, 1.9], [12, 80, 1.2], [13, 90, 0.8]], 'debit', 'boa'],
  [11, 2, [[5, 24, 3.6], [6, 20, 4.8]], 'transfer', 'coop'],
  [5, 2, [[15, 120, 0.95], [14, 30, 1.1], [19, 20, 4.4]], 'transfer', 'check'],
];

/** Builds the demo workspace — same dataset the original single-file build shipped with. */
export function seed(): Db {
  const R = mulberry32(20260813);
  const now = Date.now();

  const db: Db = {
    settings: {
      shopName: 'Copperleaf Merch Co.',
      currency: '$',
      taxRate: 0,
      maxDiscount: 15,
      address: '14 Market Lane, Brookfield',
      phone: '(555) 014-2288',
      receiptFooter: 'Thank you for shopping with us!',
    },
    users: [
      { id: 1, username: 'admin', password: 'admin123', name: 'Amelia Stone', role: 'admin', active: true, createdAt: now - 92 * DAY },
      { id: 2, username: 'keeper', password: 'keeper123', name: 'Marco Diaz', role: 'storekeeper', active: true, createdAt: now - 80 * DAY },
      { id: 3, username: 'cashier', password: 'cashier123', name: 'Nina Park', role: 'cashier', active: true, createdAt: now - 64 * DAY },
      { id: 4, username: 'tomi', password: 'cashier123', name: 'Tom Osei', role: 'cashier', active: true, createdAt: now - 51 * DAY },
    ],
    categories: [
      { id: 1, name: 'Apparel & Tees', description: 'Graphic tees, hoodies and wearables' },
      { id: 2, name: 'Mugs & Drinkware', description: 'Ceramic, enamel mugs and bottles' },
      { id: 3, name: 'Bags & Totes', description: 'Canvas totes and carryalls' },
      { id: 4, name: 'Caps & Hats', description: 'Snapbacks, beanies and caps' },
      { id: 5, name: 'Stationery', description: 'Notebooks, pens and desk goods' },
      { id: 6, name: 'Keychains & Pins', description: 'Small everyday accessories' },
      { id: 7, name: 'Stickers & Prints', description: 'Sticker packs, posters and art prints' },
      { id: 8, name: 'Home & Living', description: 'Candles, coasters and decor' },
    ],
    suppliers: [
      { id: 1, name: 'Northline Wholesale Co.', contact: 'Dana Reyes', phone: '(555) 201-8890', email: 'orders@northline.co', address: 'Unit 4, Harbor Industrial Park', createdAt: now - 88 * DAY },
      { id: 2, name: 'PrintWorks Studio', contact: 'Leo Martins', phone: '(555) 318-4410', email: 'hello@printworks.io', address: '88 Foundry Street', createdAt: now - 76 * DAY },
      { id: 3, name: 'UrbanCraft Supply', contact: 'Maya Chen', phone: '(555) 442-1187', email: 'maya@urbancraft.shop', address: '12 Weaver Lane', createdAt: now - 70 * DAY },
      { id: 4, name: 'BrightGoods Trading', contact: 'Omar Haddad', phone: '(555) 736-2255', email: 'sales@brightgoods.com', address: '305 Commerce Avenue', createdAt: now - 65 * DAY },
    ],
    products: [],
    sales: [],
    purchases: [],
    payments: [],
    invTx: [],
    audit: [
      { id: 1, date: now - 60 * DAY, userId: 1, group: 'SYSTEM', action: 'init', detail: 'Demo workspace initialised' },
    ],
  };

  PRODUCTS.forEach((p, i) => {
    db.products.push({
      id: i + 1,
      sku: p[0],
      name: p[1],
      categoryId: p[2],
      supplierId: p[3],
      unit: p[4],
      costPrice: p[5],
      sellPrice: p[6],
      qty: p[7],
      minStock: p[8],
      createdAt: now - 60 * DAY,
      updatedAt: now - Math.floor(R() * 20) * DAY,
    });
    db.invTx.push({
      id: uid(db.invTx),
      date: now - 60 * DAY + i * 3_600_000,
      productId: i + 1,
      sku: p[0],
      name: p[1],
      unit: p[4],
      type: 'initial',
      qty: p[7],
      userId: 1,
      note: 'Opening stock',
    });
  });

  const byId = (id: number): Product => db.products.find((x) => x.id === id)!;

  PURCHASES.forEach((pp, i) => {
    const items: PurchaseItem[] = pp[2].map((l) => {
      const pr = byId(l[0]);
      return { productId: l[0], sku: pr.sku, name: pr.name, unit: pr.unit, qty: l[1], cost: l[2] };
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

  db.purchases.push({
    id: 7,
    ref: 'P-00007',
    supplierId: 3,
    byUserId: 2,
    items: [
      { productId: 2, sku: 'TS-1002', name: 'Vintage Graphic Tee', unit: 'pcs', qty: 30, cost: 7.25 },
      { productId: 10, sku: 'CP-4002', name: 'Knit Beanie', unit: 'pcs', qty: 24, cost: 3.1 },
    ],
    total: 30 * 7.25 + 24 * 3.1,
    status: 'ordered',
    payMethod: 'transfer',
    bank: 'dashen',
    createdAt: now - 2 * DAY,
    receivedAt: null,
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
          qty: R() < 0.8 ? 1 : R() < 0.8 ? 2 : 3,
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
