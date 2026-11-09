"use client";
import { useEffect, useState } from "react";
import { X, Minus, Plus, ShoppingCart, Loader2, CheckCircle2, Phone, MapPin, Truck, Search, PackageCheck } from "lucide-react";
import { API_URL, request } from "../lib/adminApi";
import { imageSrc } from "../lib/vendorApi";
import { REGIONS } from "../lib/regions";

// ============================================================================
// SIPIKI — cart drawer, guest checkout and order tracking.
// The customer needs no account: phone number + delivery location, then "Tuma Oda".
// Payment is on delivery for now. The server re-checks prices and stock.
// ============================================================================

const fmt = (n) => `TSh ${Math.round(n).toLocaleString("en-US")}`;
const PHONE_OK = (v) => /^(?:\+?255|0)?[67]\d{8}$/.test(String(v).replace(/[\s-]/g, ""));
const SAVED_KEY = "sipiki_customer_v1";

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "{}") || {}; } catch { return {}; }
}
function saveDetails(d) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(d)); } catch { /* not important */ }
}

const STATUS_LABEL = {
  pending: ["Imepokelewa", "bg-amber-100 text-amber-800"],
  processing: ["Inaandaliwa", "bg-sky-100 text-sky-800"],
  shipped: ["Iko njiani", "bg-indigo-100 text-indigo-800"],
  delivered: ["Imewasilishwa", "bg-emerald-100 text-emerald-800"],
  cancelled: ["Imeghairiwa", "bg-slate-200 text-slate-600"],
};
function StatusPill({ status }) {
  const [label, cls] = STATUS_LABEL[status] || STATUS_LABEL.pending;
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>;
}

function Thumb({ line }) {
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100">
      {line.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={line.image} alt="" className="h-full w-full object-cover" />
        : <span className="text-2xl">{line.emoji || "🛍️"}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cart drawer: cart → delivery details → confirmation
// ---------------------------------------------------------------------------
export function CartDrawer({ open, onClose, cart, onTrack }) {
  const [step, setStep] = useState("cart"); // cart | form | done
  const [form, setForm] = useState({ name: "", phone: "", region: "Dar es Salaam", location: "", notes: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(null);

  useEffect(() => {
    if (!open) return;
    const s = loadSaved();
    setForm((f) => ({ ...f, name: s.name || f.name, phone: s.phone || f.phone, region: REGIONS.includes(s.region) ? s.region : f.region, location: s.location || f.location }));
  }, [open]);

  // Escape closes the drawer
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  function close() {
    onClose();
    if (step === "done") { setStep("cart"); setPlaced(null); }
  }

  function validate() {
    const e = {};
    if (!PHONE_OK(form.phone)) e.phone = "Weka namba sahihi ya simu, mfano 0712 345 678";
    if (!form.region) e.region = "Chagua mkoa";
    if (form.location.trim().length < 3) e.location = "Andika eneo ulipo (mtaa, kata au jengo)";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev) {
    ev.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setFormError("");
    try {
      const { order } = await request("/orders", {
        method: "POST", token: null,
        body: {
          items: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          phone: form.phone, name: form.name.trim(), region: form.region, location: form.location.trim(), notes: form.notes.trim(),
        },
      });
      saveDetails({ name: form.name.trim(), phone: form.phone, region: form.region, location: form.location.trim() });
      cart.clear();
      setPlaced({ ...order, phone: form.phone });
      setStep("done");
    } catch (err) {
      if (err.status === 409 && err.data?.unavailable?.length) {
        cart.removeMany(err.data.unavailable);
        setFormError(`${err.message} Tumeondoa kwenye kikapu — angalia kikapu chako kisha jaribu tena.`);
        setStep("cart");
      } else {
        setFormError(err.status === 429 ? err.message : err.message || "Imeshindikana kutuma oda. Jaribu tena.");
      }
    } finally {
      setBusy(false);
    }
  }

  const input = (bad) => `mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-orange-500 ${bad ? "border-red-400" : "border-stone-300"}`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={close} />
      <div className="relative flex h-full w-full max-w-sm flex-col bg-white shadow-2xl" role="dialog" aria-label="Kikapu">
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{step === "form" ? "Taarifa za Uwasilishaji" : step === "done" ? "Oda Imetumwa" : "Kikapu Chako"}</h2>
          <button onClick={close} aria-label="Funga" className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* ---------- step 1: the cart ---------- */}
        {step === "cart" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {formError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{formError}</p>}
              {cart.lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <ShoppingCart size={32} className="mb-2" />
                  <p className="text-sm">Kikapu chako kiko tupu.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.lines.map((line) => (
                    <div key={line.productId} className="flex items-center gap-3 rounded-lg border border-stone-200 p-2.5">
                      <Thumb line={line} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{line.title}</p>
                        <p className="text-xs text-orange-600">{fmt(line.price)}</p>
                        {line.vendor && <p className="truncate text-[11px] text-slate-400">{line.vendor}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button aria-label="Punguza" onClick={() => cart.setQuantity(line.productId, line.quantity - 1)} className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-slate-600"><Minus size={11} /></button>
                        <span className="w-5 text-center text-sm">{line.quantity}</span>
                        <button aria-label="Ongeza" onClick={() => cart.setQuantity(line.productId, line.quantity + 1)} className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-slate-600"><Plus size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.lines.length > 0 && (
              <div className="border-t border-stone-200 px-5 py-4">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Jumla</span>
                  <span className="text-base font-bold text-slate-900">{fmt(cart.subtotal)}</span>
                </div>
                <button
                  onClick={() => { setFormError(""); if (!API_URL) { setFormError("Hii ni toleo la majaribio — oda haziwezi kutumwa."); return; } setStep("form"); }}
                  className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  Endelea na Oda
                </button>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400"><Truck size={13} /> Unalipa unapopokea bidhaa</p>
              </div>
            )}
          </>
        )}

        {/* ---------- step 2: phone + location ---------- */}
        {step === "form" && (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-3 text-xs text-slate-500">Hakuna akaunti inayohitajika. Muuzaji atakupigia kupanga uwasilishaji.</p>
              {formError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{formError}</p>}

              <label htmlFor="c-phone" className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Phone size={14} /> Namba ya simu *</label>
              <input id="c-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={input(errors.phone)} />
              {errors.phone && <p className="mt-1 text-xs font-medium text-red-600">{errors.phone}</p>}

              <label htmlFor="c-region" className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><MapPin size={14} /> Mkoa *</label>
              <select id="c-region" value={form.region} onChange={(e) => set("region", e.target.value)} className={input(errors.region)}>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </select>

              <label htmlFor="c-loc" className="mt-3 block text-sm font-semibold text-slate-800">Eneo ulipo *</label>
              <input id="c-loc" autoComplete="street-address" placeholder="Mtaa, kata au jengo — mf. Mbezi Beach, karibu na Shoprite" value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={200} className={input(errors.location)} />
              {errors.location && <p className="mt-1 text-xs font-medium text-red-600">{errors.location}</p>}

              <label htmlFor="c-name" className="mt-3 block text-sm font-semibold text-slate-800">Jina lako <span className="font-normal text-slate-400">(hiari)</span></label>
              <input id="c-name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} className={input(false)} />

              <label htmlFor="c-notes" className="mt-3 block text-sm font-semibold text-slate-800">Maelezo ya ziada <span className="font-normal text-slate-400">(hiari)</span></label>
              <textarea id="c-notes" rows={2} maxLength={300} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Rangi, ukubwa, muda mzuri wa kukupigia..." className={input(false)} />

              <div className="mt-4 rounded-xl bg-orange-50 p-3 text-xs text-slate-700">
                <p className="font-bold text-orange-700">Malipo: unapopokea</p>
                <p className="mt-0.5">Lipa pesa taslimu au M-Pesa / Tigo Pesa / Airtel Money kwa muuzaji bidhaa ikifika.</p>
              </div>
            </div>
            <div className="border-t border-stone-200 px-5 py-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">Jumla ({cart.count})</span>
                <span className="text-base font-bold text-slate-900">{fmt(cart.subtotal)}</span>
              </div>
              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                {busy && <Loader2 size={16} className="animate-spin" />} Tuma Oda
              </button>
              <button type="button" onClick={() => setStep("cart")} className="mt-2 w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800">← Rudi kwenye kikapu</button>
            </div>
          </form>
        )}

        {/* ---------- step 3: confirmation ---------- */}
        {step === "done" && placed && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-6 text-center">
              <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
              <p className="mt-3 text-lg font-extrabold text-slate-900">Asante! Oda yako imepokelewa</p>
              <p className="mt-1 text-xs text-slate-500">Namba ya oda yako</p>
              <p className="mt-0.5 select-all font-mono text-2xl font-extrabold tracking-wider text-orange-600" data-testid="order-ref">{placed.ref}</p>
              <p className="mt-1 text-xs text-slate-500">Ihifadhi — utaitumia kufuatilia oda.</p>
              <ul className="mt-4 space-y-1 rounded-xl border border-stone-200 p-3 text-left text-sm">
                {placed.items.map((i, n) => (
                  <li key={n} className="flex justify-between gap-2"><span className="truncate">{i.quantity} × {i.title}</span><span className="flex-shrink-0 font-semibold">{fmt(i.unitPriceTsh * i.quantity)}</span></li>
                ))}
                <li className="flex justify-between border-t border-stone-100 pt-1 font-bold"><span>Jumla</span><span>{fmt(placed.totalTsh)}</span></li>
              </ul>
              <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">Muuzaji atakupigia kwenye <b>{placed.phone}</b> kupanga uwasilishaji. Lipa unapopokea bidhaa.</p>
            </div>
            <div className="space-y-2 border-t border-stone-200 px-5 py-4">
              <button onClick={() => { close(); onTrack?.({ ref: placed.ref, phone: placed.phone }); }} className="w-full rounded-lg border border-orange-300 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-50">Fuatilia oda</button>
              <button onClick={close} className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">Endelea Kununua</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Track an order: order number + phone number
// ---------------------------------------------------------------------------
export function TrackModal({ open, onClose, initial }) {
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  async function lookup(r, p) {
    if (busy) return;
    setBusy(true); setError(""); setOrder(null);
    try {
      const data = await request("/orders/track", { method: "POST", token: null, body: { ref: r.trim(), phone: p.trim() } });
      setOrder(data.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const s = loadSaved();
    const r = initial?.ref || "";
    const p = initial?.phone || s.phone || "";
    setRef(r); setPhone(p); setOrder(null); setError("");
    if (r && p) lookup(r, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.ref, initial?.phone]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-label="Fuatilia oda">
        <div className="flex items-start justify-between">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><PackageCheck size={20} /> Fuatilia Oda</h3>
          <button onClick={onClose} aria-label="Funga" className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); lookup(ref, phone); }} className="mt-3">
          <label htmlFor="t-ref" className="text-sm font-semibold text-slate-800">Namba ya oda</label>
          <input id="t-ref" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="SPK-XXXXXX" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-orange-500" />
          <label htmlFor="t-phone" className="mt-3 block text-sm font-semibold text-slate-800">Namba ya simu uliyotumia kuagiza</label>
          <input id="t-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
          <button type="submit" disabled={busy || !ref.trim() || !phone.trim()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Tafuta
          </button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}
        {order && (
          <div className="mt-4 rounded-xl border border-stone-200 p-4" data-testid="track-result">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm font-extrabold text-slate-900">{order.ref}</p>
              <StatusPill status={order.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Uwasilishaji: {order.location}</p>
            <ul className="mt-3 space-y-2">
              {order.items.map((i, n) => (
                <li key={n} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0"><span className="block truncate">{i.quantity} × {i.title}</span><span className="block text-[11px] text-slate-400">{i.store}</span></span>
                  <StatusPill status={i.status} />
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-stone-100 pt-2 text-sm font-bold"><span>Jumla (lipa unapopokea)</span><span>{fmt(order.totalTsh)}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
