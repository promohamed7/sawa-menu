"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import { useT } from "@/lib/i18n";
import { AnimatePresence, motion } from "motion/react";

const SPRING = { type: "spring", duration: 0.4, bounce: 0.15 } as const;

// A round "+" that widens into − qty + once the item is in the order.
export function AddStepper({ qty, onAdd, onSet, tone = "light", label }: { qty: number; onAdd: (rect: DOMRect) => void; onSet: (qty: number) => void; tone?: "light" | "dark"; label: string }) {
  const S = useT();
  const dark = tone === "dark";
  return (
    <motion.div layout transition={SPRING} className="relative shrink-0" style={{ borderRadius: 999 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {qty === 0 ? (
          <motion.button
            key="add"
            type="button"
            aria-label={S.addOne(label)}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(e.currentTarget.getBoundingClientRect());
            }}
            className={`press grid h-11 w-11 place-items-center rounded-full ${dark ? "bg-[var(--cream)] text-[var(--ink)]" : "bg-[var(--brown)] text-[var(--cream)]"}`}
            initial={{ opacity: 0, scale: 0.7, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: 90 }}
            transition={SPRING}
          >
            <Plus size={18} weight="bold" />
          </motion.button>
        ) : (
          <motion.div
            key="step"
            onClick={(e) => e.stopPropagation()}
            className={`flex h-11 items-center rounded-full p-1 ${dark ? "bg-[var(--cream)] text-[var(--ink)]" : "bg-[var(--black)] text-[var(--cream)]"}`}
            initial={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
            transition={SPRING}
          >
            <button type="button" aria-label={S.lessOne(label)} onClick={() => onSet(qty - 1)} className="press grid h-9 w-9 place-items-center rounded-full">
              <Minus size={15} weight="bold" />
            </button>
            <span className="relative grid w-6 place-items-center overflow-hidden text-[16px] font-semibold num">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={qty} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  {qty}
                </motion.span>
              </AnimatePresence>
            </span>
            <button
              type="button"
              aria-label={S.moreOne(label)}
              onClick={(e) => onAdd(e.currentTarget.getBoundingClientRect())}
              className={`press grid h-9 w-9 place-items-center rounded-full ${dark ? "bg-[var(--brown)] text-[var(--cream)]" : "bg-[var(--gold)] text-[var(--black)]"}`}
            >
              <Plus size={15} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
