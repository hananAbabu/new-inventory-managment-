# Inventory Management System

A Next.js (App Router) + React + TypeScript port of the original single-file
`inv.html` demo. Same design, same data model, same behaviour — split into real
routes, components and typed modules.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Demo accounts:

| Role        | Username  | Password     |
| ----------- | --------- | ------------ |
| Admin       | `admin`   | `admin123`   |
| Storekeeper | `keeper`  | `keeper123`  |
| Cashier     | `cashier` | `cashier123` |

Other scripts: `npm run build`, `npm start`, `npm run typecheck`.

## How it is put together

Everything runs in the browser. The workspace is seeded into `localStorage`
(`msims_db_v1`) on first load and the signed-in user is kept in `msims_ses_v1`,
exactly as the original did — there is no server, no database and no API.

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
  components/
    store.tsx            the database: load, persist, mutate, sign in/out
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
    seed.ts              the demo dataset (deterministic PRNG)
    migrate.ts           upgrades workspaces saved by an older build
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
received through it (sales), money paid out of it (received purchases), and the
net, with cash totals shown separately so nothing is double-counted.

A non-cash sale must also carry proof: a **transaction number**, a photographed
**transfer slip**, or both — the register refuses to close the sale without at
least one. The number prints on the receipt; the photo is shown on screen with
it. Slips are downscaled to 1000 px and re-encoded as JPEG (`src/lib/image.ts`)
because the whole workspace shares one ~5 MB localStorage budget, and anything
still over 400 KB after that is rejected. If a write does exceed the quota the
store says so rather than looking saved and vanishing on reload.

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

All mutations go through one function, so persistence and the audit trail can
never be forgotten:

```ts
const { update } = useStore();

update((draft, audit) => {
  draft.products.push(newProduct);
  audit('PRODUCT', 'add', `Added ${sku} — ${name}`);
});
```

`update` clones the current state, applies the recipe, writes it to
`localStorage` and re-renders. `audit` stamps the entry with the signed-in user.

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

### Older saved workspaces

`src/lib/migrate.ts` upgrades a workspace saved by an earlier build on load —
`shopkeeper` becomes `storekeeper`, the `card` and `mobile` payment methods
become `transfer` and `debit`, products without a unit default to pieces. Nobody
has to reset their data.

## Differences from `inv.html`

- Pages are real URLs, so the browser's back button, refresh and deep links work.
- Rendering is React instead of `innerHTML` string building, which removes the
  hand-rolled `esc()` escaping and the global `onclick="…"` handlers.
- Fonts are self-hosted through `next/font` rather than pulled from a CDN.
- One markup bug is fixed on the way over: the discount cell in the sales table
  was emitted outside its `<td>`, so it landed in the wrong column.

## Where a real backend would go

The data layer is deliberately isolated in `src/lib` and `components/store.tsx`.
Replacing `localStorage` with a database means swapping `update`/`loadDb` for
server actions or API routes — the pages and components read from `useStore()`
and would not need to change shape.
