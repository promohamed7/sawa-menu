# Sawa Coffee House menu

Mobile-first digital menu for Sawa Coffee House. Next.js static export on Vercel.
Orders go straight to Sawa's **INBYTE Café** cashier.

## How ordering reaches the cashier

```
guest's phone ──► this site /inbyte/* ──(vercel.json rewrite)──► INBYTE platform /api/public/v1/tenants/sawa/*
                                                                     ▲
                                        Sawa's INBYTE Café cashier ──┘ pulls new orders (outbound connector)
```

- The menu (names, prices, sold-out) is read live from the cashier: `GET /catalog`. Until the cashier is
  connected the site shows the printed menu read-only.
- Table QR: `/?table=<token>` (the token the platform prints) → dine-in at that table. Otherwise takeaway.
- `POST /orders` with an `Idempotency-Key`; a retry after a lost connection never duplicates the order.
- The guest then sees the order's status from the cashier (`GET /orders/<reference>`).

## Setting Sawa up (once)

1. **INBYTE Admin:** create the café with id `sawa`, enable online ordering (pickup and table QR), payment cash.
2. **Sawa's cashier:** «الأصناف والمنيو → استيراد منيو» with `menus/sawa.json` (the whole printed menu; set the
   real prices there afterwards, the site follows).
3. **Pair the cashier:** «الطلب أونلاين» with a pairing code from the café's Integration tab in the admin.
4. **Tables:** print the QR codes from the admin. Set the café's domain to this site so the QR codes open it.

Settings (Vercel env, optional): `NEXT_PUBLIC_INBYTE_CAFE` (default `sawa`), `NEXT_PUBLIC_INBYTE_API`
(default `/inbyte`, the rewrite in `vercel.json`).

`node --experimental-strip-types scripts/export-menu.mjs` regenerates `menus/sawa.json` from `data/menu.ts`.

```
npm install && npm run dev
```
