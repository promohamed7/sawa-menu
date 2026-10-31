"use client";

import { ArrowCounterClockwise, PaperPlaneTilt, Trash } from "@phosphor-icons/react";
import { AnimatePresence, motion, useAnimationControls, type PanInfo } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { haptic } from "@/lib/fly";
import { S, money } from "@/lib/i18n";
import { attemptId, placeOrder, settleAttempt, trackOrder, type Tracking } from "@/lib/inbyte";
import { EGYPT_MOBILE, normalizePhone, orderPayload, shares, totals, type Customer, type Resolved, type Table } from "@/lib/order";
import { Sheet } from "./Sheet";
import { AddStepper } from "./Stepper";
import { useStore } from "./store";

const EASE = [0.23, 1, 0.32, 1] as const;
type Errors = Partial<Record<"name" | "phone", string>>;
type Placed = Pick<Tracking, "publicReference" | "orderNumber" | "orderStatus" | "deliveryState" | "estimatedTotalCents" | "totalCents"> & { rejectionReason?: string | null };
const PLACED_KEY = "sawa-placed";

// The order on paper, read person by person: each name, what they chose, and
// their share. Sent, it becomes the order's live status from the cashier.
export function CartSheet({
  open,
  onClose,
  lines,
  customer,
  setCustomer,
  table,
  onLeaveTable,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  lines: Resolved[];
  customer: Customer;
  setCustomer: (c: Customer) => void;
  table: Table | null;
  onLeaveTable: () => void;
  onClear: () => void;
}) {
  const { add, setQty, party, canOrder } = useStore();
  const t = totals(lines);
  const groups = shares(lines, party);
  const many = groups.length > 1;
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"network" | "rejected" | "invalid" | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [stampAt, setStampAt] = useState<number | null>(null);
  const shake = useAnimationControls();

  // An order placed earlier stays on screen until the guest starts a new one.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLACED_KEY) ?? "null") as (Placed & { at: number }) | null;
      if (saved && Date.now() - saved.at < 6 * 3600_000) setPlaced(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Follow the order while it is in progress: every 10 s while the page is visible.
  const finished = !placed || ["COMPLETED", "REJECTED", "CANCELLED"].includes(placed.orderStatus) || placed.deliveryState === "NOT_DELIVERED";
  useEffect(() => {
    if (!placed || finished) return;
    let delay = 10_000;
    let timer = 0;
    const tick = async () => {
      if (!document.hidden) {
        const r = await trackOrder(placed.publicReference);
        if (r.ok) {
          delay = 10_000;
          setPlaced((p) => {
            const next = { ...p!, ...r.data };
            try {
              localStorage.setItem(PLACED_KEY, JSON.stringify({ ...next, at: Date.now() }));
            } catch {
              /* storage unavailable */
            }
            return next;
          });
        } else delay = Math.min(delay * 2, 60_000);
      }
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, 4000);
    return () => window.clearTimeout(timer);
  }, [placed?.publicReference, finished]);

  useEffect(() => {
    if (!stampAt) return;
    const id = window.setTimeout(() => setStampAt(null), 2600);
    return () => window.clearTimeout(id);
  }, [stampAt]);

  const set = (patch: Partial<Customer>) => {
    setCustomer({ ...customer, ...patch });
    setProblem(null);
    setErrors((e) => {
      const n = { ...e };
      (Object.keys(patch) as (keyof Errors)[]).forEach((k) => delete n[k]);
      return n;
    });
  };

  const validate = () => {
    const e: Errors = {};
    const name = customer.name.trim();
    const phone = normalizePhone(customer.phone);
    if (!table && name.length < 2) e.name = S.nameErr;
    if (!table && !EGYPT_MOBILE.test(phone)) e.phone = S.phoneErr;
    if (table && phone && !EGYPT_MOBILE.test(phone)) e.phone = S.phoneErr;
    setErrors(e);
    return e;
  };

  const send = useCallback(async () => {
    const e = validate();
    if (Object.keys(e).length) {
      haptic(30);
      shake.start({ x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.42 } });
      const first = document.querySelector<HTMLElement>(`[data-field="${Object.keys(e)[0]}"]`);
      first?.focus({ preventScroll: true });
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    haptic(18);
    setBusy(true);
    setProblem(null);
    const body = orderPayload(lines, customer, party, table);
    const r = await placeOrder({ ...body, clientRequestId: attemptId(body) });
    setBusy(false);
    if (r.ok) {
      settleAttempt();
      const p: Placed = r.data;
      setPlaced(p);
      try {
        localStorage.setItem(PLACED_KEY, JSON.stringify({ ...p, at: Date.now() }));
      } catch {
        /* storage unavailable */
      }
      setStampAt(Date.now());
      haptic(25);
      onClear();
      return;
    }
    // A definite refusal settles the attempt; a lost connection keeps it for a safe retry.
    if (r.status === 0 || r.status >= 500) setProblem("network");
    else {
      settleAttempt();
      setProblem(r.status === 404 || r.status === 403 || r.code?.includes("DISABLED") ? "rejected" : "invalid");
    }
    haptic(30);
  }, [lines, customer, party, table]);

  const newOrder = () => {
    setPlaced(null);
    try {
      localStorage.removeItem(PLACED_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  const showPlaced = placed && lines.length === 0;

  return (
    <Sheet open={open} onClose={onClose} label={S.order} className="bg-[var(--paper)] text-[var(--paper-ink)]">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <AnimatePresence>
          {stampAt && (
            <span key={stampAt} className="seal z-10 leading-tight" role="status">
              <span className="block">
                <span className="serif block text-[2.3rem] leading-none">sawa</span>
                <span className="mt-1 block text-[15px] font-semibold">{S.sent}</span>
              </span>
            </span>
          )}
        </AnimatePresence>

        <div className="flex items-end justify-between px-5 pb-3">
          <h2 className="text-[30px] font-bold leading-none">{S.order}</h2>
          {lines.length > 0 && (
            <button type="button" onClick={onClear} className="press px-1 py-2 text-[14px] font-semibold text-[#8f2418]">
              {S.clearOrder}
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          {showPlaced ? (
            <Status placed={placed} onNew={newOrder} />
          ) : lines.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-14 text-center">
              <p className="serif text-[64px] leading-none">sawa</p>
              <p className="mt-4 text-[20px] font-semibold">{S.emptyOrder}</p>
              <p className="mt-1 text-[15px] text-[var(--paper-muted)]">{S.emptyOrderHint}</p>
            </motion.div>
          ) : (
            <>
              {groups.map((g) => (
                <section key={g.who} className="mt-2">
                  {many && (
                    <div className="flex items-baseline justify-between bg-[var(--paper-2)] px-3 py-2">
                      <h3 className="text-[16px] font-bold">{g.name}</h3>
                      <span className="text-[14px] text-[var(--paper-muted)]">
                        {S.share(g.name)} <span className="serif text-[19px] text-[var(--paper-ink)] num">{money(g.totalCents)}</span>
                      </span>
                    </div>
                  )}
                  <ul>
                    <AnimatePresence initial={true}>
                      {g.lines.map((l, i) => (
                        <LineRow key={l.key} line={l} index={i} onRemove={() => setQty(l.key, 0)} onSet={(n) => setQty(l.key, n)} onAdd={(r) => add(l.productId, r, l.who)} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              ))}

              <div className="mt-5 bg-[var(--paper-ink)] px-4 py-4 text-[var(--paper)]">
                <div className="flex items-end justify-between">
                  <span className="text-[17px] font-semibold">{S.total}</span>
                  <span className="serif text-[40px] leading-none num">
                    {money(t.totalCents)} <span className="font-[family-name:var(--font-body)] text-[14px]">{S.currency}</span>
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  {S.estimate}. {S.pay}.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between bg-[var(--paper-2)] px-4 py-3">
                <span className="text-[15px] font-semibold">{table ? S.tableHere(table.label) : S.pickup}</span>
                {table && (
                  <button type="button" onClick={onLeaveTable} className="press py-1 text-[14px] text-[var(--paper-muted)] underline underline-offset-4">
                    {S.leaveTable}
                  </button>
                )}
              </div>

              <motion.div animate={shake} className="mt-4 space-y-3">
                <Field label={table ? `${S.name} (${S.optional})` : S.name} error={errors.name}>
                  <input data-field="name" autoComplete="name" maxLength={60} value={customer.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name} className="field" />
                </Field>
                <Field label={table ? `${S.phone} (${S.optional})` : S.phone} error={errors.phone}>
                  <input data-field="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={customer.phone} onChange={(e) => set({ phone: e.target.value })} aria-invalid={!!errors.phone} className="field" style={{ textAlign: "right" }} />
                </Field>
                <Field label={S.notes}>
                  <textarea rows={2} maxLength={120} value={customer.notes} placeholder={S.notesPh} onChange={(e) => set({ notes: e.target.value })} className="field resize-none" />
                </Field>
              </motion.div>

              <AnimatePresence>
                {problem && (
                  <motion.p role="alert" className="mt-4 bg-[#f3d9d3] px-4 py-3 text-[14.5px] font-medium text-[#7d1f15]" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    {problem === "network" ? S.sendFail : problem === "rejected" ? S.sendRejected : S.sendInvalid}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={send}
                disabled={busy || !canOrder}
                className="press mt-5 flex h-14 w-full items-center justify-center gap-2 bg-[var(--gold)] text-[17px] font-semibold text-[var(--gold-ink)] disabled:opacity-60"
              >
                {problem === "network" ? <ArrowCounterClockwise size={20} weight="bold" /> : <PaperPlaneTilt size={20} weight="fill" />}
                {busy ? S.sending : problem === "network" ? S.retry : S.send}
              </button>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

// Where the order is, as the cashier reports it.
const STEPS = ["RECEIVED_BY_CAFE", "ACCEPTED", "PREPARING", "READY"];
function Status({ placed, onNew }: { placed: Placed; onNew: () => void }) {
  const failed = placed.deliveryState === "NOT_DELIVERED" || ["REJECTED", "CANCELLED"].includes(placed.orderStatus);
  const stage = placed.deliveryState === "AWAITING_CAFE" ? "AWAITING_CAFE" : placed.orderStatus === "PENDING" ? "RECEIVED_BY_CAFE" : placed.orderStatus;
  const reached = STEPS.indexOf(stage === "COMPLETED" ? "READY" : stage);
  const message = placed.deliveryState === "NOT_DELIVERED" ? S.status.NOT_DELIVERED : (S.status[stage] ?? S.status.AWAITING_CAFE);
  const total = placed.totalCents ?? placed.estimatedTotalCents;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="pb-4 pt-2">
      {placed.orderNumber && <p className="text-[15px] text-[var(--paper-muted)]">{S.orderNo(placed.orderNumber)}</p>}
      <AnimatePresence mode="wait">
        <motion.p key={message} className="mt-1 text-[26px] font-bold leading-snug" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE }}>
          {message}
        </motion.p>
      </AnimatePresence>
      {placed.rejectionReason && <p className="mt-2 text-[15px] text-[#7d1f15]">{placed.rejectionReason}</p>}

      {!failed && (
        <ol className="mt-6 grid grid-cols-4 gap-1" aria-label="مراحل الطلب">
          {STEPS.map((s, i) => (
            <li key={s} className="h-1.5 overflow-hidden bg-[var(--paper-2)]">
              <motion.span className="block h-full bg-[var(--paper-ink)]" style={{ transformOrigin: "100% 50%" }} initial={{ scaleX: 0 }} animate={{ scaleX: i <= reached ? 1 : 0 }} transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }} />
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 flex items-end justify-between bg-[var(--paper-2)] px-4 py-3">
        <span className="text-[15px] font-semibold">{S.total}</span>
        <span className="serif text-[30px] leading-none num">
          {money(total)} <span className="font-[family-name:var(--font-body)] text-[13px]">{S.currency}</span>
        </span>
      </div>
      <button type="button" onClick={onNew} className="press mt-5 h-14 w-full bg-[var(--paper-ink)] text-[16px] font-semibold text-[var(--paper)]">
        {S.newOrder}
      </button>
    </motion.div>
  );
}

function LineRow({ line, index, onRemove, onSet, onAdd }: { line: Resolved; index: number; onRemove: () => void; onSet: (n: number) => void; onAdd: (r: DOMRect) => void }) {
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 110 || Math.abs(info.velocity.x) > 700) {
      haptic(20);
      onRemove();
    }
  };
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE, delay: Math.min(index, 8) * 0.05 } }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.22 } }}
      className="relative"
    >
      <div className="absolute inset-0 flex items-center justify-end px-3 text-[#8f2418]">
        <Trash size={18} weight="bold" />
      </div>
      <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.5} dragSnapToOrigin onDragEnd={onDragEnd} className="relative flex items-center gap-3 bg-[var(--paper)] py-3">
        <img src={`/img/${line.category.img}.webp`} alt="" className="h-12 w-12 shrink-0 object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[15.5px] font-semibold leading-snug">{line.product.ar}</p>
          <p className="serif text-[18px] leading-tight text-[var(--paper-muted)] num">{money(line.unitCents * line.qty)}</p>
        </div>
        <AddStepper qty={line.qty} tone="paper" label={line.product.ar} onAdd={onAdd} onSet={onSet} />
      </motion.div>
    </motion.li>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold">{label}</span>
      {children}
      <AnimatePresence>
        {error && (
          <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 block text-[14px] font-semibold text-[#8f2418]" role="alert">
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </label>
  );
}
