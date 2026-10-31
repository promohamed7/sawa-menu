import { CATALOG as BUNDLED } from "@/data/menu";

// What the page renders. Live, it comes from INBYTE Café (synced to the
// platform by the cashier): ids, names and prices are the cashier's. Bundled,
// it is the printed menu, shown read-only until the cashier is connected.

export type MenuProduct = {
  id: number;
  ar: string;
  priceCents: number | null;
  available: boolean;
  optionIds: number[]; // default choice for each required option group, if any
};

export type MenuCategory = { id: number; slug: string; ar: string; img: string; products: MenuProduct[] };

export type Catalog = { source: "live" | "bundled"; categories: MenuCategory[]; products: Map<number, { product: MenuProduct; category: MenuCategory }> };

const index = (source: Catalog["source"], categories: MenuCategory[]): Catalog => {
  const products = new Map<number, { product: MenuProduct; category: MenuCategory }>();
  for (const category of categories) for (const product of category.products) products.set(product.id, { product, category });
  return { source, categories, products };
};

export const bundledCatalog = (): Catalog =>
  index(
    "bundled",
    BUNDLED.map((c) => ({ id: c.id, slug: c.slug, ar: c.ar, img: c.img, products: c.products.map((p) => ({ id: p.id, ar: p.ar, priceCents: p.priceCents, available: true, optionIds: [] })) })),
  );

// Photos belong to sections of the printed menu; a live section takes the photo
// of the printed section with the same name, or a coffee photo if it is new.
const norm = (s: string) => s.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/^ال/, "").replace(/\s+/g, " ").trim();
const PHOTO = new Map(BUNDLED.map((c) => [norm(c.ar), { slug: c.slug, img: c.img }]));

type LiveCatalog = {
  categories: { id: number; name: string; sortOrder: number; isActive: boolean; isAvailableOnline: boolean }[];
  products: {
    id: number;
    categoryId: number;
    name: string;
    priceCents: number;
    isActive: boolean;
    isAvailableOnline: boolean;
    availability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
    modifierGroups?: { id: number; isRequired: boolean; options: { id: number }[] }[];
  }[];
};

export function liveCatalog(data: LiveCatalog): Catalog | null {
  if (!Array.isArray(data?.categories) || !Array.isArray(data?.products)) return null;
  const categories = data.categories
    .filter((c) => c.isActive && c.isAvailableOnline)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c, i) => {
      const photo = PHOTO.get(norm(c.name));
      return {
        id: c.id,
        slug: photo?.slug ?? `section-${c.id}`,
        ar: c.name,
        img: photo?.img ?? (i % 2 ? "iced-coffee" : "hot-coffee"),
        products: data.products
          .filter((p) => p.categoryId === c.id && p.isActive && p.isAvailableOnline)
          .map((p) => ({
            id: p.id,
            ar: p.name,
            priceCents: p.priceCents,
            available: p.availability !== "UNAVAILABLE",
            optionIds: (p.modifierGroups ?? []).filter((g) => g.isRequired && g.options.length).map((g) => g.options[0].id),
          })),
      };
    })
    .filter((c) => c.products.length > 0);
  return categories.length ? index("live", categories) : null;
}
