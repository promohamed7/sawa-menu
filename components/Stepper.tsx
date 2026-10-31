"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";

const SPRING = { type: "spring", duration: 0.38, bounce: 0.18 } as const;

// A square "+" that opens into − qty + once the item is in the order.
export function AddStepper({ qty, onAdd, onSet, tone = "dark", label }: { qty: number; onAdd: (rect: DOMRect) => void; onSet: (qty: number) => void; tone?: "dark" | "paper"; label: string }) {
  const paper = tone === "paper";
  return (
    <motion.div layout transition={SPRING} className="relative shrink-0">
      <AnimatePresence mode="popLayout" initial={false}>
        {qty === 0 ? (
          <motion.button
            key="add"
            type="button"
            aria-label={`أضف ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(e.currentTarget.getBoundingClientRect());
            }}
            className={`press grid h-11 w-11 place-items-center ${paper ? "bg-[var(--paper-ink)] text-[var(--paper)]" : "bg-[var(--gold)] text-[var(--gold-ink)]"}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={SPRING}
          >
            <Plus size={18} weight="bold" />
          </motion.button>
        ) : (
          <motion.div
            key="step"
            onClick={(e) => e.stopPropagation()}
            className={`flex h-11 items-center ${paper ? "bg-[var(--paper-ink)] text-[var(--paper)]" : "bg-[var(--ink)] text-[var(--ground)]"}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={SPRING}
          >
            <button type="button" aria-label={`شيل واحد ${label}`} onClick={() => onSet(qty - 1)} className="press grid h-11 w-10 place-items-center">
              <Minus size={16} weight="bold" />
            </button>
            <span className="relative grid w-6 place-items-center overflow-hidden text-[16px] font-semibold num">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={qty} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>
                  {qty}
                </motion.span>
              </AnimatePresence>
            </span>
            <button
              type="button"
              aria-label={`زود واحد ${label}`}
              onClick={(e) => onAdd(e.currentTarget.getBoundingClientRect())}
              className="press grid h-11 w-11 place-items-center bg-[var(--gold)] text-[var(--gold-ink)]"
            >
              <Plus size={16} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
