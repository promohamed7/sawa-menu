"use client";

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { forwardRef, useEffect, useRef } from "react";
import { categoryName, money, productName, useLang, useT } from "@/lib/i18n";
import { useStore } from "./store";

type Props = { count: number; totalCents: number; onOpen: () => void };

// A solid bar, not glass: the menu below stays the only rich surface.
// With more than one person at the table, its left cell shows who is ordering
// and switches to the next name on tap.
export const CartBar = forwardRef<HTMLSpanElement, Props>(function CartBar({ count, totalCents, onOpen }, ref) {
  const S = useT();
  const reduce = useReducedMotion();
  const { party, active, setActive } = useStore();
  const mv = useMotionValue(totalCents);
  const text = useTransform(mv, (v) => money(Math.round(v)));
  const target = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const c = animate(mv, totalCents, { duration: reduce ? 0 : 0.6, ease: [0.23, 1, 0.32, 1] });
    return () => c.stop();
  }, [totalCents, mv, reduce]);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let a: Animation | undefined;
    const onLand = () => {
      if (reduce) return;
      a?.cancel();
      a = el.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)", offset: 0.35 }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    };
    el.addEventListener("landed", onLand);
    return () => el.removeEventListener("landed", onLand);
  }, [count > 0, reduce]);

  const many = party.length > 1;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[600px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]"
          initial={{ y: 110, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 110, opacity: 0 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.18 }}
        >
          <div className="flex h-16 items-center gap-1 rounded-full bg-[var(--black)] p-1.5 text-[var(--cream)] shadow-[0_18px_40px_-16px_rgb(30_12_4/0.7)]">
          {many && (
            <button
              type="button"
              onClick={() => setActive((active + 1) % party.length)}
              aria-label={S.ordering(party[active])}
              className="press flex h-full max-w-[40%] shrink-0 flex-col items-start justify-center overflow-hidden rounded-full bg-[var(--cream)]/12 px-4"
            >
              <span className="text-[12px] leading-tight text-[var(--cream-muted)]">{S.orderingNow}</span>
              <span className="relative block h-[22px] w-full overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={active}
                    className="block truncate text-[16px] font-semibold leading-[22px]"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                  >
                    {party[active]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          )}
          <button type="button" onClick={onOpen} className="press flex h-full flex-1 items-center gap-3 rounded-full px-4">
            <span className="text-[16.5px] font-semibold">{S.viewOrder}</span>
            <span
              ref={(el) => {
                target.current = el;
                if (typeof ref === "function") ref(el);
                else if (ref) ref.current = el;
              }}
              className="grid h-7 min-w-7 place-items-center rounded-full bg-[var(--gold)] px-1.5 text-[14px] font-semibold text-[var(--black)] num"
            >
              {count}
            </span>
            <span className="serif ms-auto text-[25px] leading-none text-[var(--gold-soft)] num">
              <motion.span>{text}</motion.span> <span className="font-[family-name:var(--font-body)] text-[13px] font-medium">{S.currency}</span>
            </span>
          </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
