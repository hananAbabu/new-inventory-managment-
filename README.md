# Copperleaf Merch Co. — Inventory Management System

A Next.js (App Router) + React + TypeScript port of the original single-file
`inv.html` demo. Same design, same data model, same behaviour — split into real
routes, components and typed modules.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Demo accounts:

| Role       | Username  | Password     |
| ---------- | --------- | ------------ |
| Admin      | `admin`   | `admin123`   |
| Shopkeeper | `keeper`  | `keeper123`  |
| Cashier    | `cashier` | `cashier123` |

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
    selectors.ts         derived reads: money, low stock, badges, names
    navigation.ts        route table, per-role permissions, sidebar
    export.ts            sales CSV export
    schema-sql.ts        the reference relational schema shown in Settings
    utils.ts             dates, ids, refs, CSV writer
```

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
