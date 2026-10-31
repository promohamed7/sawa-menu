"use client";

import { motion, useReducedMotion } from "motion/react";
import { categoryName, money, productName, useLang, useT } from "@/lib/i18n";
import type { MenuCategory, MenuProduct } from "@/lib/catalog";
import { lineKey } from "@/lib/order";
import { AddStepper } from "./Stepper";
import { useStore } from "./store";

const EXPO = [0.16, 1, 0.3, 1] as const;

// The house favourites, by name; whatever the cashier calls them, they are
// found by name so prices and ids stay the cashier's.
const FAVOURITES = ["إسبانش لاتيه", "آيس لاتيه كريم بروليه", "آيس ماتشا فراولة", "ميلك شيك بستاشيو", "كرواسون روز بيف", "سان سبستيان"];

export function Favourites() {
  const S = useT();
  const { catalog } = useStore();
  const picks = FAVOURITES.map((n) => [...catalog.products.values()].find((h) => h.product.ar === n)).filter(Boolean) as { product: MenuProduct; category: MenuCategory }[];
  if (!picks.length) return null;
  return (
    <section className="pt-16" aria-labelledby="fav-title">
      <motion.h2
        id="fav-title"
        className="text-[30px] font-bold leading-tight"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.8, ease: EXPO }}
      >
        {S.favourites}
      </motion.h2>
      <div className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[14vw] pb-4 [scroll-padding-inline:14vw]">
        {picks.map(({ product, category }, i) => (
          <FavCard key={product.id} product={product} img={category.img} index={i} />
        ))}
      </div>
    </section>
  );
}

function FavCard({ product, img, index }: { product: MenuProduct; img: string; index: number }) {
  const { lang } = useLang();
  const S = useT();
  const { add, qtyOf, setQty, active, canOrder } = useStore();
  const orderable = canOrder && product.priceCents != null && product.available;
  return (
    <motion.article
      className="w-[72vw] max-w-[320px] shrink-0 snap-center"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.9, ease: EXPO, delay: Math.min(index, 3) * 0.08 }}
    >
      <div className="lift overflow-hidden rounded-[28px] bg-[var(--black)] text-[var(--cream)]">
        <div className="aspect-[4/5] overflow-hidden">
          <img src={`/img/${img}.webp`} alt={productName(product.ar, lang)} loading="lazy" className="h-full w-full object-cover" />
        </div>
        <div className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[17px] font-semibold">{productName(product.ar, lang)}</h3>
            {product.priceCents != null && (
              <p className="serif text-[24px] leading-tight text-[var(--gold-soft)] num">
                {money(product.priceCents)} <span className="font-[family-name:var(--font-body)] text-[13px]">{S.currency}</span>
              </p>
            )}
          </div>
          {orderable && <AddStepper qty={qtyOf(product.id)} tone="dark" label={productName(product.ar, lang)} onAdd={(r) => add(product.id, r)} onSet={(n) => setQty(lineKey(product.id, active), n)} />}
        </div>
      </div>
    </motion.article>
  );
}

// Every section opens with its photograph, revealed from a mask, then its
// items arrive row by row.
export function Section({ category }: { category: MenuCategory }) {
  const { lang } = useLang();
  const S = useT();
  const reduce = useReducedMotion();
  return (
    <section id={category.slug} data-section={category.slug} className="scroll-mt-[76px] pt-14 lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
      <div className="relative h-[236px] overflow-hidden rounded-[28px] bg-[var(--black)] lg:sticky lg:top-24 lg:h-[460px]">
        <motion.div
          className="absolute inset-0"
          initial={reduce ? false : { clipPath: "inset(16% 12% 16% 12% round 22px)", opacity: 0.4 }}
          whileInView={{ clipPath: "inset(0% 0% 0% 0% round 0px)", opacity: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 1.2, ease: EXPO }}
        >
          <img src={`/img/${category.img}.webp`} alt="" loading="lazy" className="drift absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(to_top,rgb(18_10_6/0.78),transparent)]" />
        </motion.div>
        <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-3 text-[var(--cream)]">
          <motion.h2
            className="text-[32px] font-bold leading-[1.15]"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.9, ease: EXPO, delay: 0.2 }}
          >
            {categoryName(category.ar, lang)}
          </motion.h2>
          <span className="pb-1.5 text-[14px] text-[var(--cream-muted)]">{S.items(category.products.length)}</span>
        </div>
      </div>
      <ul className="mt-3 lg:mt-0">
        {category.products.map((p, i) => (
          <Item key={p.id} product={p} index={i} />
        ))}
      </ul>
    </section>
  );
}

function Item({ product, index }: { product: MenuProduct; index: number }) {
  const { lang } = useLang();
  const S = useT();
  const { add, qtyOf, setQty, active, canOrder } = useStore();
  const reduce = useReducedMotion();
  const qty = qtyOf(product.id);
  const priced = product.priceCents != null;
  const orderable = canOrder && priced && product.available;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.6, ease: EXPO, delay: (index % 4) * 0.06 }}
    >
      <div
        role={orderable ? "button" : undefined}
        tabIndex={orderable ? 0 : undefined}
        onClick={(e) => orderable && add(product.id, e.currentTarget.getBoundingClientRect())}
        onKeyDown={(e) => orderable && (e.key === "Enter" || e.key === " ") && add(product.id, e.currentTarget.getBoundingClientRect())}
        className={`press-row flex min-h-[64px] items-center gap-3 rounded-[20px] px-3 py-2.5 transition-colors duration-300 ${qty ? "bg-[var(--bg-2)]" : ""} ${product.available ? "" : "opacity-55"}`}
      >
        <span className="min-w-0 flex-1 text-[17px] font-medium leading-snug">{productName(product.ar, lang)}</span>
        {!product.available ? (
          <span className="text-[14px] text-[var(--muted)]">{S.soldOut}</span>
        ) : priced ? (
          <span className="serif shrink-0 text-[23px] leading-none num">{money(product.priceCents!)}</span>
        ) : (
          <span className="shrink-0 text-[14px] text-[var(--muted)]">{S.soon}</span>
        )}
        {orderable && <AddStepper qty={qty} label={productName(product.ar, lang)} onAdd={(r) => add(product.id, r)} onSet={(n) => setQty(lineKey(product.id, active), n)} />}
      </div>
    </motion.li>
  );
}
