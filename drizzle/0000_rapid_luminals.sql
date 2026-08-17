CREATE TYPE "public"."bank" AS ENUM('cbe', 'boa', 'awash', 'dashen', 'coop', 'oromiya', 'shebele', 'check');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('rent', 'salary', 'transport', 'utilities', 'supplies', 'maintenance', 'tax', 'other');--> statement-breakpoint
CREATE TYPE "public"."pay_method" AS ENUM('cash', 'transfer', 'debit');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('weight', 'piece', 'carton', 'carton-piece', 'unset');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('ordered', 'received');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'storekeeper', 'cashier');--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('initial', 'purchase', 'sale', 'received', 'damage', 'lost', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('pcs', 'kg', 'l', 'carton');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" integer,
	"grp" text NOT NULL,
	"action" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"pay_method" "pay_method" NOT NULL,
	"bank" "bank",
	"txn_ref" text,
	"by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"product_id" integer NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"unit" "unit" NOT NULL,
	"type" "tx_type" NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"user_id" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"method" "pay_method" NOT NULL,
	"bank" "bank",
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category_id" integer NOT NULL,
	"supplier_id" integer,
	"product_type" "product_type" DEFAULT 'piece' NOT NULL,
	"unit" "unit" DEFAULT 'pcs' NOT NULL,
	"kg_per_piece" numeric(12, 3),
	"pieces_per_carton" integer,
	"cost_price" numeric(12, 2) NOT NULL,
	"sell_price" numeric(12, 2) NOT NULL,
	"qty" numeric(12, 3) DEFAULT '0' NOT NULL,
	"min_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"unit" "unit" NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"supplier_id" integer NOT NULL,
	"by_user_id" integer NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"status" "purchase_status" DEFAULT 'ordered' NOT NULL,
	"pay_method" "pay_method" DEFAULT 'cash' NOT NULL,
	"bank" "bank",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"unit" "unit" NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"qty" numeric(12, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"cashier_id" integer NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"pay_method" "pay_method" NOT NULL,
	"bank" "bank",
	"txn_ref" text,
	"txn_photo" text,
	"amount_paid" numeric(12, 2) NOT NULL,
	"change_due" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"shop_name" text NOT NULL,
	"currency" text NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"max_discount" integer NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"receipt_footer" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_date_idx" ON "audit_log" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_key" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_ref_key" ON "expenses" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "inv_tx_date_idx" ON "inventory_transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "inv_tx_product_idx" ON "inventory_transactions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "payments_sale_idx" ON "payments" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_key" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_ref_key" ON "purchases" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_ref_key" ON "sales" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "sales_created_idx" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" USING btree ("username");