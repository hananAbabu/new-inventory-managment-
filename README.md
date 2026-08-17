# Inventory Management System

A Next.js (App Router) + React + TypeScript inventory, point-of-sale and
purchasing system for a wholesale shop, backed by Postgres.

## Running it

The database runs in this project's own container, on port **15433** so it
cannot collide with anything else you have on the default Postgres port.

```bash
npm install
cp .env.example .env.local
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Then open http://localhost:3000. Sign in with:

| Role        | Username  | Password     |
| ----------- | --------- | ------------ |
| Admin       | `admin`   | `admin123`   |
| Storekeeper | `keeper`  | `keeper123`  |
| Cashier     | `cashier` | `cashier123` |

| Script                | What it does                                      |
| --------------------- | ------------------------------------------------- |
| `npm run db:up`       | starts the Postgres container                     |
| `npm run db:down`     | stops it (the named volume keeps the data)        |
| `npm run db:generate` | writes a new migration from schema changes        |
| `npm run db:migrate`  | applies pending migrations                        |
| `npm run db:seed`     | fills an empty database; refuses a populated one  |
| `npm run db:reset`    | truncates everything, then seeds                  |
| `npm run db:studio`   | opens Drizzle Studio against the database         |

Also `npm run build`, `npm start`, `npm run typecheck`.

## How it is put together

Postgres holds everything. The browser holds no data: it signs in, receives the
workspace, and calls server actions to change it.

```
sign in ──▶ server action ──▶ Postgres
                  │
workspace ◀───────┘   every mutation returns the refreshed workspace,
                      which the client swaps in wholesale
```

Reads are one query set: signing in loads the whole workspace, which suits one
shop's volume and lets every page keep reading from a single in-memory object.
Writes are individually typed server actions — `saveExpense`, `recordSale`,
`receivePurchase` and so on — each of which re-checks the session and the role
on the server, runs inside a transaction, writes its audit row, and returns the
new workspace. A client that lies about its role gets nothing: the check is in
the action, not the UI.

Passwords are bcrypt hashes and never leave the database — the workspace sent to
the browser carries an empty string in their place. The session is a random id
in an httpOnly, SameSite=Lax cookie with a row in `sessions`.

```
src/
  app/
    layout.tsx           root shell: fonts, providers, #print-area
    page.tsx             redirects to /dashboard or /login
    login/               sign-in screen
    (app)/               authenticated routes, wrapped in <AppShell>
      layout.tsx           sidebar + topbar + role guard
      dashboard/           three dashboards, one per role
      pos/                 register: product grid, cart, payment, receipt
      products/  categories/  inventory/  low-stock/
      sales/     my-sales/    suppliers/   purchases/
      reports/   users/       audit/       settings/
  server/                server-only, never bundled into the browser
    schema.ts            Drizzle tables and enums
    db.ts                the connection, built lazily on first query
    auth.ts              bcrypt hashing, sessions, requireUser(role)
    workspace.ts         loads the whole workspace and reshapes it for the client
    mutate.ts            transaction wrapper returning the refreshed workspace
    seed-db.ts           fills the database
    verify.ts            read-path and schema smoke test
  app/actions/           'use server' entry points, one file per area
    session.ts  catalog.ts  inventory.ts  purchases.ts  sales.ts
    expenses.ts admin.ts
  components/
    store.tsx            client cache of the workspace + run(action) helper
    app-shell.tsx        navigation chrome + low-stock bell + denied panel
    modal.tsx            <Modal> and the useConfirm() promise dialog
    toast.tsx            useToast()
    chart.tsx            Chart.js wrapper that cleans up on unmount
    receipt.tsx          receipt view, print portal, receipt modal
    ui.tsx               Kpi, EmptyState, Badge, StatStrip, Pager, Tabs, hooks
    icon.tsx             the icon set
    forms/               product and stock-movement forms
  lib/
    types.ts             every entity in the workspace
    seed.ts              the starting dataset (deterministic PRNG)
    banks.ts             payment methods and the bank list
    units.ts             units of measure and quantity parsing/formatting
    selectors.ts         derived reads: money, low stock, badges, names
    navigation.ts        route table, per-role permissions, sidebar
    export.ts            sales CSV export
    product-types.ts     the four product configurations and their conversions
    expenses.ts          expense categories
    utils.ts             dates, ids, refs, CSV writer
```

### Payments and banks

Every sale and every purchase records how the money moved: **cash**, **transfer**
or **debit**. Transfer and debit also name the account — CBE, BOA, Awash, Dashen,
Coop, Oromiya, Shebele or Check — while cash stores `null`. The bank picker only
appears for the methods that need one, so a cash sale can never carry a stale
bank.

Reports has a **Banks** tab that reconciles each account on its own: money
received through it (sales), money paid out of it (received purchases and
expenses), and the net, with cash totals shown separately so nothing is
double-counted.

A non-cash sale must also carry proof: a **transaction number**, a photographed
**transfer slip**, or both — the register refuses to close the sale without at
least one. The number prints on the receipt; the photo is shown on screen with
it. Slips are downscaled to 1000 px and re-encoded as JPEG (`src/lib/image.ts`)
before they are sent, so the row stays small and the upload stays quick; anything
still over 400 KB after that is rejected.

### What the storekeeper cannot see

Stock valuation is owner information. The storekeeper's dashboard, inventory
page and inventory report show quantities, minimums and status but no cost
value, retail value or margin, and the Product Performance report (revenue and
profit per product) is admin-only. Per-product cost and selling price stay
visible on the Products page, since the storekeeper maintains the catalogue and
has to enter them.

### Units of measure

Products carry a unit: **pcs**, **carton**, **kg** or **L**. Weight and volume
accept fractions (a 0.01 step, rounded to three decimals to keep float drift out
of stock levels); pieces and cartons stay whole. Prices are per unit, and every
quantity in the UI — stock levels, cart lines, purchase lines, movements,
receipts — is printed with its unit.

One consequence worth knowing: a total that mixes kilograms with pieces means
nothing, so aggregate counters report **line items** or **SKUs** rather than
summing quantities across products. Per-product totals (product performance,
stock levels) are unit-consistent and still add up.

### Writing to the workspace

Pages never touch the database. They call a server action through `run`, which
swaps in the workspace the action returns and surfaces any error as a toast:

```ts
const { run } = useStore();

if (await run(() => saveExpense(null, input))) toast('Expense recorded');
```

Server-side, every action goes through `mutate`, so a write, its audit row and
the refreshed workspace are one transaction — none of them can be forgotten:

```ts
return mutate(async (tx) => {
  const user = await requireUser('admin');      // session + role, server-side
  const ref = await nextRef(tx, schema.expenses, 'E');
  await tx.insert(schema.expenses).values({ ... });
  await writeAudit(tx, user.id, 'EXPENSE', 'add', `${ref} · ${amount}`);
});
```

### Permissions

`src/lib/navigation.ts` owns the route table. Each route lists the roles allowed
to open it; the authenticated layout renders the "Access restricted" panel
instead of the page when the check fails, and the sidebar only shows what the
role can reach.

### Purchase orders

An order can be edited or deleted while it is **ordered**. Once **received** it
is locked: its stock is already in the inventory log, and rewriting or removing
it would leave that log describing goods no order accounts for. Editing an
ordered purchase can also receive it in one step.

### Schema changes

`src/server/schema.ts` is the source of truth. Change it, then:

```bash
npm run db:generate    # writes the SQL migration into drizzle/
npm run db:migrate     # applies it
```

Migrations are committed, so every copy of the database can be brought up to the
same shape. Do not hand-edit a migration that has already been applied.

## Notes

- The receipt is framed like the transfer-slip attachment — same rounded border
  and inset panel — so a receipt and a slip read as two of the same document.
  Printing strips the frame and prints the receipt alone.
- Sale and purchase lines live in their own tables (`sale_items`,
  `purchase_items`); the workspace rebuilds them into the embedded arrays the
  pages read.
- Money is `numeric(12,2)` and quantities `numeric(12,3)`; both are parsed back
  into numbers on the way out, so no float drift reaches the database.
