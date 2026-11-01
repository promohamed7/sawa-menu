// The INBYTE platform's public API for this café. Orders placed here wait on
// the platform until Sawa's INBYTE Café cashier pulls them (outbound connector),
// so they appear in the cashier's incoming orders. Contract:
// diab-cafe-main/docs/WEBSITE_INTEGRATION.md.
//
// By default the calls go to /inbyte on this site, which vercel.json rewrites
// to the platform, so no cross-origin setup is needed on the platform.

export const API = (process.env.NEXT_PUBLIC_INBYTE_API ?? "/inbyte").replace(/\/$/, "");
export const CAFE = process.env.NEXT_PUBLIC_INBYTE_CAFE ?? "sawa";
const base = () => `${API}/tenants/${encodeURIComponent(CAFE)}`;

async function call<T>(path: string, init?: RequestInit, timeoutMs = 12000): Promise<{ ok: true; data: T } | { ok: false; status: number; code?: string }> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base()}${path}`, { ...init, signal: ctl.signal, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: body as T };
    return { ok: false, status: res.status, code: body?.error?.code };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    window.clearTimeout(t);
  }
}

export const getCatalog = () => call<unknown>("/catalog");
export const getConfig = () => call<{ features?: { onlineOrdering?: boolean } }>("/config");
export const resolveTable = (token: string) => call<{ tableLabel: string }>("/tables/resolve", { method: "POST", body: JSON.stringify({ token }) });

export type OrderPayload = {
  orderType: "PICKUP" | "DINE_IN";
  orderChannel: "ONLINE" | "TABLE_QR";
  items: { productId: number; quantity: number; modifierOptionIds: number[] }[];
  customerInfo: { fullName?: string; phone?: string; customerNotes?: string };
  tableToken?: string;
  paymentMethod: "CASH";
  expectedTotalCents: number;
  clientRequestId: string;
};

export type OrderAck = {
  publicReference: string;
  orderNumber: string | null;
  orderStatus: string;
  deliveryState?: "AWAITING_CAFE" | "RECEIVED_BY_CAFE" | "NOT_DELIVERED";
  estimatedTotalCents: number;
  totalCents: number | null;
};

export type Tracking = OrderAck & { rejectionReason: string | null };

export const placeOrder = (p: OrderPayload) => call<OrderAck>("/orders", { method: "POST", body: JSON.stringify(p), headers: { "Idempotency-Key": p.clientRequestId } }, 20000);
export const trackOrder = (ref: string) => call<Tracking>(`/orders/${encodeURIComponent(ref)}`);

// One id per distinct order attempt: a retry of the same order after a network
// failure reuses it so the platform never creates the order twice; any change
// to the order makes a new one.
const ATTEMPT = `sawa-attempt-${CAFE}`;
export function attemptId(payloadWithoutId: Omit<OrderPayload, "clientRequestId">) {
  const fingerprint = JSON.stringify(payloadWithoutId);
  try {
    const saved = JSON.parse(localStorage.getItem(ATTEMPT) ?? "null") as { id: string; fingerprint: string; at: number } | null;
    if (saved && saved.fingerprint === fingerprint && Date.now() - saved.at < 12 * 3600_000) return saved.id;
  } catch {
    /* storage unavailable */
  }
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(ATTEMPT, JSON.stringify({ id, fingerprint, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
  return id;
}
export const settleAttempt = () => {
  try {
    localStorage.removeItem(ATTEMPT);
  } catch {
    /* storage unavailable */
  }
};
