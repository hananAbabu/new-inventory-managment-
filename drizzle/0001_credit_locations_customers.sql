CREATE TYPE "public"."payment_party" AS ENUM('sale', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('paid', 'partial', 'pending');--> statement-breakpoint
CREATE TYPE "public"."stock_location" AS ENUM('store', 'shop');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Debit becomes credit: rename the value so existing rows carry over untouched.
ALTER TYPE "public"."pay_method" RENAME VALUE 'debit' TO 'credit';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "sale_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "qty_store" numeric(12, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "qty_shop" numeric(12, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
-- Everything counted so far is held in the store until someone moves it.
UPDATE "products" SET "qty_store" = "qty";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "qty";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "qty" numeric(12, 3) GENERATED ALWAYS AS (qty_store + qty_shop) STORED;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "location" "stock_location" DEFAULT 'store' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "party" "payment_party" DEFAULT 'sale' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "purchase_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "txn_ref" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "paid_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "taken_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "payment_status" "payment_status" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "location" "stock_location" DEFAULT 'store' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "location" "stock_location" DEFAULT 'shop' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "payment_status" "payment_status" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_name_key" ON "customers" USING btree ("name");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_taken_by_user_id_users_id_fk" FOREIGN KEY ("taken_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_purchase_idx" ON "payments" USING btree ("purchase_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_one_party" CHECK ((party = 'sale' AND sale_id IS NOT NULL AND purchase_id IS NULL)
       OR (party = 'purchase' AND purchase_id IS NOT NULL AND sale_id IS NULL));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK (amount > 0);
--> statement-breakpoint
-- Purchases recorded before credit existed were paid on delivery.
UPDATE "purchases" SET "amount_paid" = "total", "payment_status" = 'paid';--> statement-breakpoint
-- Sales carry their own paid figure already; label it and backfill the ledger.
UPDATE "sales" SET "payment_status" = CASE
  WHEN "amount_paid" <= 0 THEN 'pending'::"public"."payment_status"
  WHEN "amount_paid" + 0.001 < "total" THEN 'partial'::"public"."payment_status"
  ELSE 'paid'::"public"."payment_status" END;--> statement-breakpoint
UPDATE "payments" SET "paid_at" = "created_at", "party" = 'sale';
