// Writes menus/sawa.json, the file Sawa's INBYTE Café cashier imports
// («الأصناف والمنيو → استيراد منيو»). Run: node --experimental-strip-types scripts/export-menu.mjs
import { writeFileSync } from "node:fs";
import { CATALOG } from "../data/menu.ts";

// The printed menu leaves the Frappuccino unpriced; the cashier needs a price to
// import it, so it takes its section's price until the café sets the real one.
const PLACEHOLDER = { "فرابتشينو": 13500 };

const categories = CATALOG.map((c) => ({
  name: c.ar,
  products: c.products.map((p) => ({ name: p.ar, priceCents: p.priceCents ?? PLACEHOLDER[p.ar] })),
}));
writeFileSync(new URL("../menus/sawa.json", import.meta.url), JSON.stringify({ format: "inbyte-menu/v1", categories }, null, 2) + "\n");
console.log(categories.length, "sections,", categories.reduce((n, c) => n + c.products.length, 0), "items");
