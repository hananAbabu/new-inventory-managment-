'use server';

import { and, eq, ne, sql } from 'drizzle-orm';
import { requireUser } from '@/server/auth';
import { schema } from '@/server/db';
import { AppError, mutate, type Tx } from '@/server/mutate';
import { money, quantity, writeAudit } from '@/server/workspace';
import type { ProductType, Unit } from '@/lib/types';
import type { ActionResult } from './shared';

export interface ProductInput {
  sku: string;
  name: string;
  categoryId: number;
  supplierId: number | null;
  productType: ProductType;
  unit: Unit;
  kgPerPiece: number | null;
  piecesPerCarton: number | null;
  costPrice: number;
  sellPrice: number;
  minStock: number;
  /** Opening stock — only honoured when creating. */
  qty?: number;
}

function validateProduct(input: ProductInput) {
  if (!input.sku.trim() || !input.name.trim()) throw new AppError('SKU and name are required');
  if (!(input.costPrice >= 0) || !(input.sellPrice >= 0) || !(input.minStock >= 0)) {
    throw new AppError('Prices and minimum stock must be valid numbers');
  }
  if (input.productType === 'weight' && !(Number(input.kgPerPiece) > 0)) {
    throw new AppError('Enter how many kilograms are in one sack');
  }
  if (input.productType === 'carton-piece' && !(Number(input.piecesPerCarton) > 0)) {
    throw new AppError('Enter how many pieces are in one carton');
  }
}

async function assertSkuFree(tx: Tx, sku: string, exceptId?: number) {
  const clash = await tx
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(
      exceptId
        ? and(eq(sql`lower(${schema.products.sku})`, sku.toLowerCase()), ne(schema.products.id, exceptId))
        : eq(sql`lower(${schema.products.sku})`, sku.toLowerCase()),
    )
    .limit(1);
  if (clash.length) throw new AppError('A product with this SKU already exists');
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');
    validateProduct(input);
    await assertSkuFree(tx, input.sku.trim());

    const openingQty = Math.max(0, input.qty ?? 0);
    const rows = await tx
      .insert(schema.products)
      .values({
        sku: input.sku.trim(),
        name: input.name.trim(),
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        productType: input.productType,
        unit: input.unit,
        kgPerPiece: input.kgPerPiece == null ? null : quantity(input.kgPerPiece),
        piecesPerCarton: input.piecesPerCarton,
        costPrice: money(input.costPrice),
        sellPrice: money(input.sellPrice),
        qty: quantity(openingQty),
        minStock: quantity(input.minStock),
      })
      .returning({ id: schema.products.id });

    const productId = rows[0].id;
    if (openingQty > 0) {
      await tx.insert(schema.inventoryTransactions).values({
        productId,
        sku: input.sku.trim(),
        name: input.name.trim(),
        unit: input.unit,
        type: 'initial',
        qty: quantity(openingQty),
        userId: user.id,
        note: 'Opening stock',
      });
    }
    await writeAudit(tx, user.id, 'PRODUCT', 'add', `Added ${input.sku} — ${input.name}`);
  });
}

export async function updateProduct(id: number, input: ProductInput): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');
    validateProduct(input);
    await assertSkuFree(tx, input.sku.trim(), id);

    await tx
      .update(schema.products)
      .set({
        sku: input.sku.trim(),
        name: input.name.trim(),
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        productType: input.productType,
        unit: input.unit,
        kgPerPiece: input.kgPerPiece == null ? null : quantity(input.kgPerPiece),
        piecesPerCarton: input.piecesPerCarton,
        costPrice: money(input.costPrice),
        sellPrice: money(input.sellPrice),
        minStock: quantity(input.minStock),
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id));

    await writeAudit(tx, user.id, 'PRODUCT', 'edit', `Updated ${input.sku} — ${input.name}`);
  });
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');
    const rows = await tx
      .select({ sku: schema.products.sku, name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);
    if (!rows.length) throw new AppError('That product no longer exists');

    const sold = await tx
      .select({ id: schema.saleItems.id })
      .from(schema.saleItems)
      .where(eq(schema.saleItems.productId, id))
      .limit(1);
    if (sold.length) {
      throw new AppError('Cannot delete — this product appears in sales history');
    }

    await tx.delete(schema.products).where(eq(schema.products.id, id));
    await writeAudit(tx, user.id, 'PRODUCT', 'delete', `Deleted ${rows[0].sku} — ${rows[0].name}`);
  });
}

/* ---------------- categories ---------------- */

export async function saveCategory(
  id: number | null,
  name: string,
  description: string,
): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin');
    const nameV = name.trim();
    if (!nameV) throw new AppError('Name required');

    const clash = await tx
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(sql`lower(${schema.categories.name})`, nameV.toLowerCase()));
    if (clash.some((c) => c.id !== id)) throw new AppError('Category already exists');

    if (id) {
      await tx
        .update(schema.categories)
        .set({ name: nameV, description: description.trim() })
        .where(eq(schema.categories.id, id));
      await writeAudit(tx, user.id, 'CATEGORY', 'edit', `Renamed category to ${nameV}`);
    } else {
      await tx.insert(schema.categories).values({ name: nameV, description: description.trim() });
      await writeAudit(tx, user.id, 'CATEGORY', 'add', `Added category ${nameV}`);
    }
  });
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin');
    const inUse = await tx
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.categoryId, id))
      .limit(1);
    if (inUse.length) throw new AppError('Cannot delete — products are assigned to this category');

    const rows = await tx
      .select({ name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.id, id))
      .limit(1);
    await tx.delete(schema.categories).where(eq(schema.categories.id, id));
    await writeAudit(tx, user.id, 'CATEGORY', 'delete', `Deleted category ${rows[0]?.name ?? id}`);
  });
}

/* ---------------- suppliers ---------------- */

export interface SupplierInput {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
}

export async function saveSupplier(
  id: number | null,
  input: SupplierInput,
): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');
    const nameV = input.name.trim();
    if (!nameV) throw new AppError('Name required');

    const clash = await tx
      .select({ id: schema.suppliers.id })
      .from(schema.suppliers)
      .where(eq(sql`lower(${schema.suppliers.name})`, nameV.toLowerCase()));
    if (clash.some((s) => s.id !== id)) throw new AppError('Supplier already exists');

    const values = {
      name: nameV,
      contact: input.contact.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
    };

    if (id) {
      await tx.update(schema.suppliers).set(values).where(eq(schema.suppliers.id, id));
      await writeAudit(tx, user.id, 'SUPPLIER', 'edit', `Updated supplier ${nameV}`);
    } else {
      await tx.insert(schema.suppliers).values(values);
      await writeAudit(tx, user.id, 'SUPPLIER', 'add', `Added supplier ${nameV}`);
    }
  });
}

export async function deleteSupplier(id: number): Promise<ActionResult> {
  return mutate(async (tx) => {
    const user = await requireUser('admin', 'storekeeper');
    const used = await tx
      .select({ id: schema.purchases.id })
      .from(schema.purchases)
      .where(eq(schema.purchases.supplierId, id))
      .limit(1);
    if (used.length) {
      throw new AppError('Cannot delete — purchase history exists for this supplier');
    }

    const rows = await tx
      .select({ name: schema.suppliers.name })
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, id))
      .limit(1);

    await tx
      .update(schema.products)
      .set({ supplierId: null })
      .where(eq(schema.products.supplierId, id));
    await tx.delete(schema.suppliers).where(eq(schema.suppliers.id, id));
    await writeAudit(tx, user.id, 'SUPPLIER', 'delete', `Deleted supplier ${rows[0]?.name ?? id}`);
  });
}
