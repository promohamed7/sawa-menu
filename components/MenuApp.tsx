"use client";

import { InstagramLogo, FacebookLogo, WhatsappLogo, Plus, X } from "@phosphor-icons/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { STORE } from "@/data/menu";
import { bundledCatalog, liveCatalog, type Catalog } from "@/lib/catalog";
import { getCatalog, getConfig, resolveTable } from "@/lib/inbyte";
import { flyToCart, haptic } from "@/lib/fly";
import { type Lang, LangCtx, STRINGS, categoryName, productName, useLang, useT } from "@/lib/i18n";
import { cartReducer, lineKey, resolve, totals, type Customer, type Line, type Table } from "@/lib/order";
import { CartBar } from "./CartBar";
import { CartSheet } from "./CartSheet";
import { Favourites, Section } from "./Menu";
import { StoreCtx, useStore, type Store } from "./store";

const EXPO = [0.16, 1, 0.3, 1] as const;

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
  const [lang, setLangRaw] = useState<Lang>("ar");
  const S = STRINGS[lang];
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

    getConfig().then((r) => setOrderingOn(r.ok && r.data?.features?.onlineOrdering === true));
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
  // Language: remembered on this phone; the page turns to read left-to-right in English.
  useEffect(() => {
    const saved = read<Lang | null>("sawa-lang", null);
    if (saved === "en" || saved === "ar") setLangRaw(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = STRINGS[lang].dir;
    // "أنا" / "Me" follows the language; names people typed stay as they are.
    setParty((p) => (p[0] === STRINGS.ar.me || p[0] === STRINGS.en.me ? [STRINGS[lang].me, ...p.slice(1)] : p));
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangRaw(l);
    write("sawa-lang", l);
    haptic(8);
  }, []);
  const langCtx = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  useEffect(() => void (ready && write("sawa-cart", lines)), [lines, ready]);
  useEffect(() => void (ready && write("sawa-party", party)), [party, ready]);
  useEffect(() => void (ready && write("sawa-customer", customer)), [customer, ready]);

  // Ordering from the phone is a switch in INBYTE Admin (Café → Ordering → Online ordering).
  // Off, the page is the menu only and guests order from the cashier.
  const [orderingOn, setOrderingOn] = useState(false);
  const canOrder = catalog.source === "live" && orderingOn;
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
    <LangCtx.Provider value={langCtx}>
    <StoreCtx.Provider value={store}>
      <MotionConfig reducedMotion="user">
        <Hero table={table?.label ?? ""} count={t.count} canOrder={canOrder} onOrder={() => setCartOpen(true)} />
        <div className="relative z-10 -mt-8 rounded-t-[32px] bg-[var(--bg)]">
          <Watermark />
          <div className="mx-auto w-full max-w-[600px] lg:max-w-[1120px] overflow-x-clip px-4 pt-8">
            <Intro />
            <AnimatePresence>
              {tableError && (
                <motion.p role="alert" className="mt-6 rounded-[20px] bg-[#f3d9d3] px-4 py-3 text-[15px] text-[#7d1f15]" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {S.tableBad}
                </motion.p>
              )}
            </AnimatePresence>
            <Favourites />
          </div>
          <CategoryBar />
          <div className="mx-auto w-full max-w-[600px] lg:max-w-[1120px] overflow-x-clip px-4">
            {!canOrder && ready && (
              <motion.p className="mt-6 rounded-[20px] bg-[var(--bg-2)] px-4 py-3 text-[15px] leading-relaxed text-[var(--muted)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                {S.menuOnly}
              </motion.p>
            )}
            <main className="pb-16">
              {catalog.categories.map((c) => (
                <Section key={c.slug} category={c} />
              ))}
            </main>
          </div>
          <Closing />
        </div>

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
    </LangCtx.Provider>
  );
}

// First screen: two cups raised together (سوا), full bleed, and the name over
// them. The photo opens from a close-up, the letters rise one by one, and on
// scroll the photo sinks while the menu slides up over it.
function Hero({ table, count, canOrder, onOrder }: { table: string; count: number; canOrder: boolean; onOrder: () => void }) {
  const S = useT();
  return (
    <header className="relative h-[86svh] min-h-[560px] overflow-hidden bg-[var(--black)] text-[var(--cream)]">
      <div className="hero-photo absolute inset-0">
        <motion.img
          src="/img/hero.webp"
          alt={S.heroAlt}
          width={1400}
          height={933}
          fetchPriority="high"
          className="h-full w-full object-cover"
          initial={{ scale: 1.25, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: EXPO }}
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(18_10_6/0.55),transparent_30%,transparent_45%,rgb(18_10_6/0.82))]" />

      <nav className="relative z-10 mx-auto flex max-w-[600px] lg:max-w-[1120px] items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
        <motion.span className="serif text-[26px] leading-none text-[var(--gold-soft)]" dir="ltr" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EXPO, delay: 0.3 }}>
          sawa
        </motion.span>
        <motion.div className="flex items-center gap-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EXPO, delay: 0.38 }}>
          {table && <span className="rounded-full bg-[var(--cream)]/15 px-3 py-2 text-[14px]">{table}</span>}
          <LangSwitch />
          {canOrder && (
          <button type="button" onClick={onOrder} className="press flex h-11 items-center gap-2 rounded-full bg-[var(--cream)] px-4 text-[15px] font-semibold text-[var(--ink)]">
            {S.viewOrder}
            <AnimatePresence mode="popLayout" initial={false}>
              {count > 0 && (
                <motion.span key={count} className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--brown)] px-1.5 text-[13px] text-[var(--cream)] num" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}>
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          )}
        </motion.div>
      </nav>

      <div className="hero-name absolute inset-x-0 bottom-14 z-10 mx-auto max-w-[600px] lg:max-w-[1120px] origin-bottom px-4">
        <h1>
          <span className="sr-only">Sawa Coffee House سوا كوفي هاوس</span>
          <span aria-hidden="true" dir="ltr" className="serif block text-center leading-[0.8] text-[var(--cream)]" style={{ fontSize: "clamp(110px, 36vw, 210px)", letterSpacing: "-0.05em" }}>
            {"sawa".split("").map((ch, i) => (
              <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <motion.span className="inline-block" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 1, ease: EXPO, delay: 0.25 + i * 0.06 }}>
                  {ch}
                </motion.span>
              </span>
            ))}
          </span>
        </h1>
        <motion.p className="mt-3 text-center text-[19px] font-medium text-[var(--cream)]/90" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EXPO, delay: 0.7 }}>
          {S.tagline}
        </motion.p>
      </div>
    </header>
  );
}

// Arabic / English. The label names the other language, in its own script.
function LangSwitch() {
  const { lang, setLang } = useLang();
  const S = useT();
  return (
    <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label={S.switchLabel} className="press relative grid h-11 min-w-11 place-items-center overflow-hidden rounded-full bg-[var(--cream)]/15 px-3 text-[15px] font-semibold">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={lang} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ duration: 0.3, ease: EXPO }}>
          {S.switchTo}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

// The beige ground carries the name as a faint watermark, set in staggered
// diagonal rows like monogrammed paper. It scrolls with the menu and sits
// behind everything (negative z inside the panel's stacking context).
function Watermark() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden rounded-t-[32px]">
      <defs>
        <pattern id="sawa-mark" width="200" height="132" patternUnits="userSpaceOnUse" patternTransform="rotate(-16)">
          <text x="10" y="44" direction="ltr" className="serif" fill="var(--brown)" fillOpacity="0.075" style={{ fontSize: 34, letterSpacing: "-1px" }}>
            sawa
          </text>
          <text x="110" y="110" direction="ltr" className="serif" fill="var(--brown)" fillOpacity="0.075" style={{ fontSize: 34, letterSpacing: "-1px" }}>
            sawa
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sawa-mark)" />
    </svg>
  );
}

// What this is and what to do, right under the photo.
function Intro() {
  const S = useT();
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EXPO, delay: 0.85 }}>
      <a href="#hot-coffee" className="press flex h-14 items-center justify-center rounded-full bg-[var(--brown)] text-[16px] font-semibold text-[var(--cream)]">
        {S.seeMenu}
      </a>
    </motion.div>
  );
}

// Sticky section bar: a brown pill slides to the section on screen and the bar
// keeps it centred.
function CategoryBar() {
  const S = useT();
  const { lang } = useLang();
  const { catalog } = useStore();
  const [active, setActive] = useState(catalog.categories[0]?.slug);
  const strip = useRef<HTMLDivElement>(null);
  const jumping = useRef(false);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-section]");
    const io = new IntersectionObserver(
      (entries) => {
        if (jumping.current) return;
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-90px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [catalog]);

  useEffect(() => {
    const chip = strip.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (strip.current && chip) strip.current.scrollTo({ left: chip.offsetLeft - strip.current.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const jump = (slug: string) => {
    const el = document.getElementById(slug);
    if (!el) return;
    setActive(slug);
    haptic(6);
    jumping.current = true;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
    window.setTimeout(() => (jumping.current = false), 900);
  };

  return (
    <nav className="sticky top-0 z-20 mt-12 bg-[var(--bg)] pb-2 pt-[calc(env(safe-area-inset-top)+10px)]" aria-label={S.sections}>
      <div ref={strip} className="no-scrollbar mx-auto flex max-w-[600px] gap-1 overflow-x-auto px-4 lg:max-w-[1120px] [scroll-padding-inline:16px]">
        {catalog.categories.map((c) => {
          const on = c.slug === active;
          return (
            <button key={c.slug} data-tab={c.slug} type="button" onClick={() => jump(c.slug)} className="press relative h-11 shrink-0 rounded-full px-4 text-[15px] font-semibold">
              {on && <motion.span layoutId="cat" className="absolute inset-0 rounded-full bg-[var(--brown)]" transition={{ type: "spring", duration: 0.45, bounce: 0.15 }} />}
              <span className={`relative whitespace-nowrap transition-colors duration-200 ${on ? "text-[var(--cream)]" : "text-[var(--muted)]"}`}>{categoryName(c.ar, lang)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// The close: black, their Instagram handle as display type, and the name
// returning across the full width.
function Closing() {
  const S = useT();
  return (
    <footer className="rounded-t-[32px] bg-[var(--black)] text-[var(--cream)]">
      <div className="mx-auto flex min-h-[80svh] w-full max-w-[600px] lg:max-w-[1120px] flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+104px)] pt-10">
        <p className="max-w-[26ch] text-[19px] leading-snug">{S.opening}</p>
        <a href={STORE.instagram} target="_blank" rel="noopener" dir="ltr" className="serif mt-auto block leading-[0.95] text-[var(--gold-soft)] transition-colors duration-200 hover:text-[var(--cream)]" style={{ fontSize: "12.6vw" }}>
          @sawacoffee
          <br />
          official
        </a>
        <div className="mt-6 flex gap-2 text-[15px]">
          <a href={STORE.instagram} target="_blank" rel="noopener" className="press flex h-11 items-center gap-1.5 rounded-full bg-[var(--cream)]/10 px-4">
            <InstagramLogo size={18} weight="fill" /> Instagram
          </a>
          <a href={STORE.facebook} target="_blank" rel="noopener" className="press flex h-11 items-center gap-1.5 rounded-full bg-[var(--cream)]/10 px-4">
            <FacebookLogo size={18} weight="fill" /> Facebook
          </a>
        </div>
        {STORE.whatsapp && (
          <a href={`https://wa.me/${STORE.whatsapp}`} target="_blank" rel="noopener" className="press mt-2 flex h-11 w-fit items-center gap-2 rounded-full bg-[var(--cream)]/10 px-4 text-[15px]">
            <WhatsappLogo size={18} weight="fill" /> WhatsApp
            <span dir="ltr" className="tabular-nums text-[var(--gold-soft)]">+{STORE.whatsapp.replace(/^(\d{2})(\d{3})(\d{3})(\d+)$/, "$1 $2 $3 $4")}</span>
          </a>
        )}
        <svg viewBox="0 0 300 96" className="mt-10 block w-full" role="img" aria-label="sawa">
          <text x="150" y="80" textAnchor="middle" className="serif" fill="var(--cream)" style={{ fontSize: 118, letterSpacing: "-6px" }}>
            sawa
          </text>
        </svg>
        <p className="mt-2 text-[13px] text-[var(--cream-muted)]">{S.credit}</p>
      </div>
    </footer>
  );
}
