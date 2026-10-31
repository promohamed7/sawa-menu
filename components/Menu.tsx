"use client";

import { Plus } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { MenuCategory as Category, MenuProduct as Product } from "@/lib/catalog";
import { haptic } from "@/lib/fly";
import { S, money } from "@/lib/i18n";
import { lineKey } from "@/lib/order";
import { AddStepper } from "./Stepper";
import { useStore } from "./store";

const EASE = [0.23, 1, 0.32, 1] as const;

// The menu as one word filling the column, then a stack of filled bars that
// open in place, like the folded pages of a menu card.
export function Menu() {
  const { catalog } = useStore();
  const [open, setOpen] = useState<Set<string>>(() => new Set([catalog.categories[0]?.slug]));
  const toggle = (slug: string) => {
    haptic(6);
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });
  };

  return (
    <section id="menu" className="scroll-mt-4 pt-28 [container-type:inline-size]">
      <motion.h2
        className="font-bold leading-[0.95] text-[var(--ink)]"
        style={{ fontSize: "37cqw" }}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        {S.menuWord}
      </motion.h2>
      <ul className="mt-6 space-y-1.5">
        {catalog.categories.map((c, i) => (
          <Bar key={c.slug} category={c} index={i} open={open.has(c.slug)} onToggle={() => toggle(c.slug)} />
        ))}
      </ul>
    </section>
  );
}

function Bar({ category, index, open, onToggle }: { category: Category; index: number; open: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      id={category.slug}
      className="bg-[var(--ground-2)]"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.05, ease: EASE }}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="press-row flex h-14 w-full items-center gap-3 px-[18px] text-start">
        <span className="flex-1 text-[16.5px] font-semibold">{category.ar}</span>
        <span className="text-[14px] text-[var(--muted)]">{S.items(category.products.length)}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0.2 }} className={open ? "text-[var(--gold)]" : "text-[var(--ink)]"}>
          <Plus size={20} weight="regular" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-[18px] pb-4">
              <div className="aspect-[16/10] overflow-hidden">
                <img src={`/img/${category.img}.webp`} alt={category.ar} loading="lazy" width={770} height={532} className="settle h-full w-full object-cover" />
              </div>
              <ul className="mt-2">
                {category.products.map((p, i) => (
                  <Item key={p.id} product={p} index={i} />
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function Item({ product, index }: { product: Product; index: number }) {
  const { add, qtyOf, setQty, active, canOrder } = useStore();
  const qty = qtyOf(product.id);
  const priced = product.priceCents != null;
  const orderable = canOrder && priced && product.available;
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12 + Math.min(index, 10) * 0.025, ease: EASE }}
      className="flex min-h-[60px] items-center gap-3 py-2"
    >
      <button
        type="button"
        disabled={!orderable}
        onClick={(e) => orderable && add(product.id, e.currentTarget.getBoundingClientRect())}
        className={`flex min-w-0 flex-1 items-baseline gap-3 py-2 text-start disabled:cursor-default ${product.available ? "" : "opacity-60"}`}
      >
        <span className="min-w-0 flex-1 text-[16px] leading-snug">{product.ar}</span>
        {!product.available ? (
          <span className="shrink-0 text-[14px] text-[var(--muted)]">{S.soldOut}</span>
        ) : priced ? (
          <span className="serif shrink-0 text-[21px] leading-none text-[var(--ink)] num">{money(product.priceCents!)}</span>
        ) : (
          <span className="shrink-0 text-[14px] text-[var(--muted)]">{S.soon}</span>
        )}
      </button>
      {orderable && <AddStepper qty={qty} label={product.ar} onAdd={(r) => add(product.id, r)} onSet={(n) => setQty(lineKey(product.id, active), n)} />}
    </motion.li>
  );
}
