"use client";

import { InstagramLogo, FacebookLogo, Plus, X } from "@phosphor-icons/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { STORE } from "@/data/menu";
import { bundledCatalog, liveCatalog, type Catalog } from "@/lib/catalog";
import { getCatalog, resolveTable } from "@/lib/inbyte";
import { flyToCart, haptic } from "@/lib/fly";
import { S } from "@/lib/i18n";
import { cartReducer, lineKey, resolve, totals, type Customer, type Line, type Table } from "@/lib/order";
import { CartBar } from "./CartBar";
import { CartSheet } from "./CartSheet";
import { Menu } from "./Menu";
import { StoreCtx, useStore, type Store } from "./store";

const EASE = [0.23, 1, 0.32, 1] as const;

const read = <V,>(k: string, d: V): V => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as V) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};

const EMPTY: Customer = { name: "", phone: "", notes: "" };
const TABLE_KEY = "sawa-table";
const TABLE_TTL = 3 * 3600_000; // a table session ends after 3 hours

export default function MenuApp() {
  const [lines, dispatch] = useReducer(cartReducer, [] as Line[]);
  const [catalog, setCatalog] = useState<Catalog>(bundledCatalog);
  const [customer, setCustomer] = useState<Customer>(EMPTY);
  const [party, setParty] = useState<string[]>([S.me]);
  const [active, setActiveRaw] = useState(0);
  const [table, setTable] = useState<Table | null>(null);
  const [tableError, setTableError] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const badgeRef = useRef<HTMLSpanElement | null>(null);

  // Restore state, load the cashier's live menu, and bind a table QR (?table=<token>).
  useEffect(() => {
    dispatch({ type: "load", lines: read<Line[]>("sawa-cart", []) });
    const savedParty = read<string[]>("sawa-party", [S.me]);
    setParty(savedParty.length ? savedParty : [S.me]);
    setCustomer({ ...EMPTY, ...read<Partial<Customer>>("sawa-customer", {}) });
    setReady(true);

    getCatalog().then((r) => {
      const live = r.ok ? liveCatalog(r.data as Parameters<typeof liveCatalog>[0]) : null;
      if (live) setCatalog(live);
    });

    const url = new URL(window.location.href);
    const token = url.searchParams.get("table");
    if (token) {
      // The token is a credential for the table: take it out of the address bar.
      url.searchParams.delete("table");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      resolveTable(token).then((r) => {
        if (r.ok && r.data?.tableLabel) {
          const t = { token, label: r.data.tableLabel };
          setTable(t);
          try {
            sessionStorage.setItem(TABLE_KEY, JSON.stringify({ ...t, at: Date.now() }));
          } catch {
            /* storage unavailable */
          }
        } else setTableError(true);
      });
    } else {
      try {
        const saved = JSON.parse(sessionStorage.getItem(TABLE_KEY) ?? "null") as (Table & { at: number }) | null;
        if (saved && Date.now() - saved.at < TABLE_TTL) setTable({ token: saved.token, label: saved.label });
      } catch {
        /* storage unavailable */
      }
    }
  }, []);
  useEffect(() => void (ready && write("sawa-cart", lines)), [lines, ready]);
  useEffect(() => void (ready && write("sawa-party", party)), [party, ready]);
  useEffect(() => void (ready && write("sawa-customer", customer)), [customer, ready]);

  const canOrder = catalog.source === "live";
  const resolved = useMemo(() => resolve(lines, catalog), [lines, catalog]);
  const t = useMemo(() => totals(resolved), [resolved]);
  const qtyMap = useMemo(() => new Map(lines.map((l) => [lineKey(l.productId, l.who), l.qty])), [lines]);
  const who = Math.min(active, party.length - 1);

  const add = useCallback<Store["add"]>(
    (id, from, w) => {
      dispatch({ type: "add", productId: id, who: w ?? who });
      haptic();
      const img = catalog.products.get(id)?.category.img ?? "hot-coffee";
      if (from) requestAnimationFrame(() => flyToCart(from, `/img/${img}.webp`, badgeRef.current));
    },
    [who, catalog],
  );
  const setQty = useCallback((key: string, qty: number) => {
    dispatch({ type: "set", key, qty });
    haptic(8);
  }, []);
  const setActive = useCallback((n: number) => {
    setActiveRaw(n);
    haptic(6);
  }, []);
  const addPerson = useCallback((name: string) => {
    setParty((p) => {
      setActiveRaw(p.length);
      return [...p, name];
    });
    haptic(10);
  }, []);
  const removePerson = useCallback((n: number) => {
    if (n === 0) return;
    dispatch({ type: "drop-person", who: n });
    setParty((p) => p.filter((_, i) => i !== n));
    setActiveRaw((a) => (a === n ? 0 : a > n ? a - 1 : a));
    haptic(12);
  }, []);
  const leaveTable = useCallback(() => {
    setTable(null);
    try {
      sessionStorage.removeItem(TABLE_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const store = useMemo<Store>(
    () => ({ catalog, canOrder, qtyOf: (id) => qtyMap.get(lineKey(id, who)) ?? 0, add, setQty, party, active: who, setActive, addPerson, removePerson, openOrder: () => setCartOpen(true) }),
    [catalog, canOrder, qtyMap, who, add, setQty, party, setActive, addPerson, removePerson],
  );

  return (
    <StoreCtx.Provider value={store}>
      <MotionConfig reducedMotion="user">
        <div className="mx-auto w-full max-w-[600px] overflow-x-clip px-4">
          <Hero table={table?.label ?? ""} count={t.count} onOrder={() => setCartOpen(true)} />
          <AnimatePresence>
            {tableError && (
              <motion.p role="alert" className="mt-6 bg-[var(--ground-2)] px-4 py-3 text-[15px]" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {S.tableBad}
              </motion.p>
            )}
            {!canOrder && ready && (
              <motion.p className="mt-6 bg-[var(--ground-2)] px-4 py-3 text-[15px] leading-relaxed text-[var(--muted)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
                {S.menuOnly}
              </motion.p>
            )}
          </AnimatePresence>
          <main className="pb-24">
            <Menu />
            <Together />
          </main>
        </div>
        <Closing />

        <CartBar ref={badgeRef} count={t.count} totalCents={t.totalCents} onOpen={() => setCartOpen(true)} />
        <CartSheet
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          lines={resolved}
          customer={customer}
          setCustomer={setCustomer}
          table={table}
          onLeaveTable={leaveTable}
          onClear={() => dispatch({ type: "clear" })}
        />
      </MotionConfig>
    </StoreCtx.Provider>
  );
}

// First screen: two cups raised together (سوا), and the name below them,
// large enough to be the building's sign.
function Hero({ table, count, onOrder }: { table: string; count: number; onOrder: () => void }) {
  return (
    <header className="relative pt-[calc(env(safe-area-inset-top)+12px)]">
      <div className="relative">
        <div className="relative h-[56svh] min-h-[380px] overflow-hidden bg-[var(--brown)]">
          <motion.img
            src="/img/hero.webp"
            alt="كوبايتين لاتيه بيتخبطوا في بعض"
            width={1400}
            height={933}
            fetchPriority="high"
            className="cups-drift absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, ease: EASE }}
          />
          <nav className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-[var(--ground)] px-4 py-1 text-[15px]">
            <a href="#menu" className="press py-2.5 font-medium">
              {S.menuWord}
            </a>
            <div className="flex items-center gap-4">
              {table && <span className="text-[14px] text-[var(--gold)]">{table}</span>}
              <button type="button" onClick={onOrder} className="press py-2.5 font-semibold text-[var(--ink)]">
                {S.viewOrder}
                {count > 0 && <span className="ms-1.5 text-[var(--gold)] num">{count}</span>}
              </button>
            </div>
          </nav>
        </div>

        <h1 className="monument relative z-10 -mt-[11vw] origin-top text-center leading-none">
          <span className="sr-only">سوا كوفي هاوس</span>
          <span aria-hidden="true" dir="ltr" className="serif block text-[var(--gold)]" style={{ fontSize: "clamp(96px, 31vw, 186px)", letterSpacing: "-0.045em" }}>
            {"sawa".split("").map((ch, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ opacity: 0, y: "0.35em" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.45 + i * 0.07 }}
              >
                {ch}
              </motion.span>
            ))}
          </span>
        </h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.85 }} className="mt-5">
        <p className="text-[22px] font-semibold leading-snug">{S.tagline}</p>
        <p className="mt-2 max-w-[34ch] text-[16px] leading-relaxed text-[var(--muted)]">{S.heroSub}</p>
        <a href="#menu" className="press mt-6 flex h-14 items-center justify-between bg-[var(--gold)] px-5 text-[16px] font-semibold text-[var(--gold-ink)]">
          افتح المنيو
          <span className="serif text-[22px] leading-none num">12</span>
        </a>
      </motion.div>
    </header>
  );
}

// The live thing: the table's names as tabs. Whoever is selected is ordering;
// everything added goes on their part of the bill.
function Together() {
  const { party, active, setActive, addPerson, removePerson, openOrder } = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const submit = () => {
    const n = name.trim();
    if (!n) return setAdding(false);
    addPerson(n);
    setName("");
    setAdding(false);
  };

  return (
    <section id="together" className="-mx-4 mt-28 bg-[var(--brown)] px-4 pb-10 pt-4">
      <motion.div className="aspect-square overflow-hidden" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.8 }}>
        <motion.img
          src="/img/together.webp"
          alt="فناجين قهوة على ترابيزة واحدة"
          width={1100}
          height={1650}
          loading="lazy"
          className="h-full w-full object-cover"
          initial={{ scale: 1.12 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.4, ease: EASE }}
        />
      </motion.div>

      <div className="no-scrollbar -mx-4 mt-6 flex gap-5 overflow-x-auto px-4 text-[17px]" role="tablist" aria-label={S.togetherTitle}>
        {party.map((p, i) => {
          const on = i === active;
          return (
            <span key={`${p}-${i}`} className="relative flex shrink-0 items-center">
              <button type="button" role="tab" aria-selected={on} onClick={() => setActive(i)} className={`press relative pb-2 pt-1 font-semibold transition-colors duration-200 ${on ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                {p}
                {on && <motion.span layoutId="who" className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--gold)]" transition={{ type: "spring", duration: 0.4, bounce: 0.15 }} />}
              </button>
              {i > 0 && on && (
                <button type="button" aria-label={S.remove(p)} onClick={() => removePerson(i)} className="press -me-2 ms-1 grid h-9 w-9 place-items-center text-[var(--muted)]">
                  <X size={14} weight="bold" />
                </button>
              )}
            </span>
          );
        })}
      </div>

      <h2 className="mt-8 text-[34px] font-bold leading-tight">{S.togetherTitle}</h2>
      <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-[var(--ink)]">{S.togetherBody}</p>

      <AnimatePresence initial={false} mode="wait">
        {adding ? (
          <motion.form
            key="form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="mt-8 flex"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <label className="sr-only" htmlFor="friend">
              {S.friendPh}
            </label>
            <input ref={input} id="friend" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={S.friendPh} maxLength={18} enterKeyHint="done" className="field field-dark h-[60px] flex-1" />
            <button type="submit" className="press h-[60px] bg-[var(--gold)] px-6 text-[16px] font-semibold text-[var(--gold-ink)]">
              {S.addFriend}
            </button>
          </motion.form>
        ) : (
          <motion.div key="cells" className="mt-8 grid grid-cols-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: EASE }}>
            <button type="button" onClick={() => setAdding(true)} className="press flex h-[60px] items-center justify-center gap-2 bg-[var(--ink)] text-[16px] font-semibold text-[var(--ground)]">
              <Plus size={16} weight="bold" />
              {S.addFriend}
            </button>
            <button type="button" onClick={openOrder} className="press flex h-[60px] items-center justify-center bg-[var(--brown-2)] text-[16px] font-semibold">
              {S.viewOrder}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// The close: inverse colours, their Instagram handle as display type, and the
// name returning across the full width.
function Closing() {
  return (
    <footer className="bg-[var(--paper)] text-[var(--paper-ink)]">
      <div className="mx-auto flex min-h-[92svh] w-full max-w-[600px] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-10">
        <p className="max-w-[24ch] text-[19px] font-medium leading-snug">{S.opening}. تابعونا علشان تعرفوا الافتتاح وكل جديد.</p>
        <a href={STORE.instagram} target="_blank" rel="noopener" dir="ltr" className="serif mt-auto block break-all leading-[0.95] transition-colors duration-200 hover:text-[#8a5a1c]" style={{ fontSize: "13.4vw" }}>
          @{STORE.instagramHandle.replace("official", "")}
          <br />
          official
        </a>
        <div className="mt-8 flex gap-6 text-[15px]">
          <a href={STORE.instagram} target="_blank" rel="noopener" className="press flex items-center gap-1.5 py-2">
            <InstagramLogo size={18} weight="fill" /> Instagram
          </a>
          <a href={STORE.facebook} target="_blank" rel="noopener" className="press flex items-center gap-1.5 py-2">
            <FacebookLogo size={18} weight="fill" /> Facebook
          </a>
        </div>
        <svg viewBox="0 0 300 92" className="mt-10 block w-full" role="img" aria-label="sawa">
          <text x="150" y="78" textAnchor="middle" className="serif" fill="var(--paper-ink)" style={{ fontSize: 112, letterSpacing: "-5px" }}>
            sawa
          </text>
        </svg>
        <p className="mt-2 text-[13px] text-[var(--paper-muted)]">سوا كوفي هاوس. الصور من Unsplash.</p>
      </div>
    </footer>
  );
}
