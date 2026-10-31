import type { Catalog, MenuCategory, MenuProduct } from "./catalog";
import type { OrderPayload } from "./inbyte";

// "سوا" means together: a table orders as a group. Every line belongs to one
// person at the table (`who`, an index into the party), so the order and the
// bill read person by person. The cashier receives one order with the items
// combined, and who ordered what in the order notes.

export type Line = { productId: number; qty: number; who: number };

export type Customer = { name: string; phone: string; notes: string };
export type Table = { token: string; label: string };

export type Resolved = Line & { key: string; product: MenuProduct; category: MenuCategory; unitCents: number };

export const MAX_QTY = 20; // the platform's limit per line

export const lineKey = (productId: number, who = 0) => `${productId}:${who}`;

export function resolve(lines: Line[], catalog: Catalog): Resolved[] {
  return lines.flatMap((l) => {
    const hit = catalog.products.get(l.productId);
    if (!hit || hit.product.priceCents == null) return [];
    return [{ ...l, ...hit, key: lineKey(l.productId, l.who), unitCents: hit.product.priceCents }];
  });
}

export function totals(lines: Resolved[]) {
  let totalCents = 0;
  let count = 0;
  for (const l of lines) {
    count += l.qty;
    totalCents += l.unitCents * l.qty;
  }
  return { totalCents, count };
}

// Each person's share of the bill, in party order, skipping anyone with nothing.
export function shares(lines: Resolved[], party: string[]) {
  return party
    .map((name, who) => {
      const mine = lines.filter((l) => l.who === who);
      return { who, name, lines: mine, ...totals(mine) };
    })
    .filter((s) => s.lines.length > 0);
}

type Action =
  | { type: "add"; productId: number; who: number; qty?: number }
  | { type: "set"; key: string; qty: number }
  | { type: "drop-person"; who: number }
  | { type: "clear" }
  | { type: "load"; lines: Line[] };

export function cartReducer(state: Line[], a: Action): Line[] {
  switch (a.type) {
    case "add": {
      const k = lineKey(a.productId, a.who);
      if (state.some((l) => lineKey(l.productId, l.who) === k))
        return state.map((l) => (lineKey(l.productId, l.who) === k ? { ...l, qty: Math.min(MAX_QTY, l.qty + (a.qty ?? 1)) } : l));
      return [...state, { productId: a.productId, who: a.who, qty: a.qty ?? 1 }];
    }
    case "set":
      return a.qty <= 0 ? state.filter((l) => lineKey(l.productId, l.who) !== a.key) : state.map((l) => (lineKey(l.productId, l.who) === a.key ? { ...l, qty: Math.min(MAX_QTY, a.qty) } : l));
    case "drop-person":
      // Their items move to the first person rather than vanishing from the order.
      return state.reduce<Line[]>((acc, l) => {
        const who = l.who === a.who ? 0 : l.who > a.who ? l.who - 1 : l.who;
        const hit = acc.find((x) => x.productId === l.productId && x.who === who);
        if (hit) hit.qty = Math.min(MAX_QTY, hit.qty + l.qty);
        else acc.push({ ...l, who });
        return acc;
      }, []);
    case "clear":
      return [];
    case "load":
      return a.lines.filter((l) => Number.isInteger(l.productId) && l.qty > 0).map((l) => ({ ...l, who: l.who ?? 0 }));
  }
}

export const EGYPT_MOBILE = /^(\+20|0020|0)?1[0125][0-9]{8}$/;
export const normalizePhone = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[\s-]/g, "");

// The platform keeps notes to 200 characters: the guest's own note first, then who ordered what.
function orderNotes(lines: Resolved[], party: string[], notes: string) {
  const groups = shares(lines, party);
  const split = groups.length > 1 ? groups.map((g) => `${g.name}: ${g.lines.map((l) => `${l.product.ar}×${l.qty}`).join("، ")}`).join(" | ") : "";
  const text = [notes.trim(), split].filter(Boolean).join(" | ");
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

// The items are combined across people: the cashier prepares and prices them once.
export function orderPayload(lines: Resolved[], c: Customer, party: string[], table: Table | null): Omit<OrderPayload, "clientRequestId"> {
  const items = new Map<number, { productId: number; quantity: number; modifierOptionIds: number[] }>();
  for (const l of lines) {
    const it = items.get(l.productId) ?? { productId: l.productId, quantity: 0, modifierOptionIds: l.product.optionIds };
    it.quantity = Math.min(MAX_QTY, it.quantity + l.qty);
    items.set(l.productId, it);
  }
  const notes = orderNotes(lines, party, c.notes);
  return {
    orderType: table ? "DINE_IN" : "PICKUP",
    orderChannel: table ? "TABLE_QR" : "ONLINE",
    items: [...items.values()],
    customerInfo: {
      ...(c.name.trim() ? { fullName: c.name.trim().slice(0, 60) } : {}),
      ...(c.phone.trim() ? { phone: normalizePhone(c.phone) } : {}),
      ...(notes ? { customerNotes: notes } : {}),
    },
    ...(table ? { tableToken: table.token } : {}),
    paymentMethod: "CASH",
    expectedTotalCents: totals(lines).totalCents,
  };
}
