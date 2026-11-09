"use client";
import Link from "next/link";
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import {
  LayoutDashboard, Package, ClipboardList, Store, LogOut, Lock, Loader2, Plus, X, Pencil, Trash2,
  Eye, EyeOff, ImagePlus, ChevronDown, Upload, Clock, Ban, XCircle, CheckCircle2, Circle, TrendingUp, Wallet, MapPin, Phone, Mail, FileText,
} from "lucide-react";
import { apiConfigured, request } from "../lib/adminApi";
import { REGIONS } from "../lib/regions";
import { vrequest, getVendorToken, setVendorToken, getShopId, setShopId, createShop, imageSrc, shrinkImage, checkPhoto, uploadProductImage } from "../lib/vendorApi";

// ============================================================================
// SIPIKI — Vendor portal (/vendor)
// A registered business signs in and sees, depending on its application status:
//   pending → "under review" · rejected → the reason · suspended → the reason
//   active  → dashboard: overview · products (with photos) · orders · profile
// ============================================================================

const MAX_PHOTOS = 4;
const fmt = (n) => `TSh ${(n || 0).toLocaleString("en-US")}`;
const FONT = { fontFamily: "'Segoe UI', system-ui, sans-serif" };

// ---- sign-in -----------------------------------------------------------------

function LoginScreen({ onSignedIn, notice }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await request("/auth/login", { method: "POST", body: { email: email.trim(), password }, token: null });
      if (data.user?.role !== "vendor") {
        setError(data.user?.role === "admin" ? "Akaunti ya msimamizi huingia kupitia /admin." : "Akaunti hii si ya muuzaji.");
        return;
      }
      setVendorToken(data.token);
      onSignedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4" style={FONT}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-5 flex items-baseline gap-3">
          <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-3xl font-extrabold text-transparent">Sipiki</span>
          <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white">MUUZAJI</span>
        </div>
        <h1 className="text-lg font-extrabold text-slate-900">Ingia kwenye Portal yako</h1>
        <p className="mt-1 text-xs text-slate-500">Tumia barua pepe na nenosiri ulilosajili nalo.</p>
        {notice && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{notice}</p>}

        <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor="v-email">Barua pepe</label>
        <input id="v-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500" />

        <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="v-password">Nenosiri</label>
        <input id="v-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500" />

        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} {busy ? "Inaingia..." : "Ingia"}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500">
          Huna akaunti? <Link href="/register" className="font-bold text-orange-600 hover:underline">Fungua Duka Lako</Link>
        </p>
        <Link href="/" className="mt-2 block text-center text-xs text-slate-400 hover:text-slate-600">← Rudi kwenye duka</Link>
      </form>
    </div>
  );
}

// ---- session wrapper (what the /vendor page renders) ---------------------------

const ShopCtx = createContext({ shops: [], currentId: null, switchShop: () => {}, openNewShop: () => {} });

const SHOP_STATUS = {
  pending: ["Inasubiri", "bg-amber-100 text-amber-800"],
  active: ["Hai", "bg-emerald-100 text-emerald-800"],
  rejected: ["Limekataliwa", "bg-red-100 text-red-700"],
  suspended: ["Limesimamishwa", "bg-slate-200 text-slate-600"],
};

export default function SipikiVendor() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState("portal"); // portal | newshop

  const signOut = useCallback((message = "") => {
    setVendorToken(null);
    setShopId(null);
    setView("portal");
    setMe(null);
    setNotice(message);
  }, []);

  const loadMe = useCallback(async () => {
    try {
      setMe(await vrequest("/vendors/me"));
    } catch (err) {
      if (err.status === 404 && err.data?.code === "shop_not_found") { setShopId(null); try { setMe(await vrequest("/vendors/me")); return; } catch { /* fall through to sign-out */ } }
      signOut(err.status === 401 || err.status === 403 ? "Muda wa kuingia umeisha. Tafadhali ingia tena." : err.message);
    } finally {
      setChecking(false);
    }
  }, [signOut]);

  useEffect(() => {
    if (!apiConfigured || !getVendorToken()) { setChecking(false); return; }
    loadMe();
  }, [loadMe]);

  if (!apiConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
        <div className="max-w-md rounded-2xl bg-white p-7 text-sm text-slate-700 shadow-2xl">
          <h1 className="text-lg font-extrabold text-slate-900">Seva haijaunganishwa</h1>
          <p className="mt-2">Weka <code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_API_URL</code> kisha ujenge upya (redeploy) tovuti.</p>
        </div>
      </div>
    );
  }
  if (checking) return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300"><Loader2 className="animate-spin" /></div>;
  if (!me) return <LoginScreen notice={notice} onSignedIn={() => { setShopId(null); setNotice(""); setChecking(true); loadMe(); }} />;

  const ctx = {
    shops: me.shops || [],
    currentId: me.id,
    switchShop: (id) => { setShopId(id); setView("portal"); setChecking(true); loadMe(); },
    openNewShop: () => setView("newshop"),
  };
  return (
    <ShopCtx.Provider value={ctx}>
      {view === "newshop"
        ? <NewShop me={me} onSignOut={signOut} onCancel={() => setView("portal")} onCreated={(shop) => ctx.switchShop(shop.id)} />
        : <Portal key={me.id} me={me} onSignOut={signOut} onRefresh={loadMe} />}
    </ShopCtx.Provider>
  );
}

// ---- shop switcher (header) ------------------------------------------------------

function ShopMenu({ me }) {
  const { shops, currentId, switchShop, openNewShop } = useContext(ShopCtx);
  const [open, setOpen] = useState(false);
  const canAdd = shops.some((s) => s.status === "active");
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} data-testid="shop-menu"
        className="flex max-w-[14rem] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800">
        <Store size={15} className="flex-shrink-0" /> <span className="truncate">{me.storeName}</span> <ChevronDown size={14} className="flex-shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl">
            <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Maduka yangu</p>
            {shops.map((s) => {
              const [label, cls] = SHOP_STATUS[s.status] || SHOP_STATUS.pending;
              return (
                <button key={s.id} role="menuitem" onClick={() => { setOpen(false); if (s.id !== currentId) switchShop(s.id); }}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-stone-50 ${s.id === currentId ? "bg-orange-50/60" : ""}`}>
                  <span className="min-w-0 truncate font-semibold text-slate-800">{s.storeName}</span>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
                </button>
              );
            })}
            {canAdd && (
              <button role="menuitem" onClick={() => { setOpen(false); openNewShop(); }} className="flex w-full items-center gap-2 border-t border-stone-100 px-4 py-3 text-left text-sm font-bold text-orange-700 hover:bg-orange-50">
                <Plus size={16} /> Ongeza duka jipya
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- add another shop ------------------------------------------------------------

const BUSINESS_TYPES = ["Mtu Binafsi", "Kampuni (Ltd)", "Ushirika / Kikundi"];
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const DOC_OK = ["application/pdf", "image/jpeg", "image/png"];

function NewShop({ me, onSignOut, onCancel, onCreated }) {
  const [form, setForm] = useState({ businessName: "", businessType: "", region: "", location: "", description: "", tin: "" });
  const [cats, setCats] = useState(null); // categories open for registration
  const [chosen, setChosen] = useState(new Set());
  const [files, setFiles] = useState({ licenseDoc: null, tinDoc: null });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request("/vendors/categories", { token: null }).then((r) => setCats(r.data)).catch(() => setCats([]));
  }, []);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const input = (bad) => `mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-orange-500 ${bad ? "border-red-400" : "border-stone-300"}`;
  const Err = ({ k }) => (errors[k] ? <p className="mt-1 text-xs font-medium text-red-600">{errors[k]}</p> : null);

  function pickFile(field, file) {
    setErrors((e) => ({ ...e, [field]: undefined }));
    if (!file) { setFiles((f) => ({ ...f, [field]: null })); return; }
    if (!DOC_OK.includes(file.type)) { setErrors((e) => ({ ...e, [field]: "Tumia PDF, JPG au PNG" })); return; }
    if (file.size > MAX_DOC_BYTES) { setErrors((e) => ({ ...e, [field]: "Faili ni kubwa mno (kiwango ni 5 MB)" })); return; }
    setFiles((f) => ({ ...f, [field]: file }));
  }

  function validate() {
    const e = {};
    if (form.businessName.trim().length < 3) e.businessName = "Andika jina la duka (angalau herufi 3)";
    if (!form.businessType) e.businessType = "Chagua aina ya biashara";
    if (!form.region) e.region = "Chagua mkoa";
    if (form.location.trim().length < 3) e.location = "Andika eneo la duka";
    if (chosen.size === 0) e.categories = "Chagua angalau kundi moja";
    if (form.tin.replace(/\D/g, "").length !== 9) e.tin = "TIN ina tarakimu 9";
    if (!files.licenseDoc) e.licenseDoc = "Pakia leseni ya biashara ya duka hili";
    if (!files.tinDoc) e.tinDoc = "Pakia cheti cha TIN cha duka hili";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev) {
    ev.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setFormError("");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, typeof v === "string" ? v.trim() : v));
      body.append("categories", JSON.stringify([...chosen]));
      body.append("licenseDoc", files.licenseDoc);
      body.append("tinDoc", files.tinDoc);
      const shop = await createShop(body);
      onCreated(shop);
    } catch (err) {
      if (err.status === 401 || err.status === 403 && !err.data?.error?.includes("kwanza")) { onSignOut("Muda wa kuingia umeisha. Tafadhali ingia tena."); return; }
      const d = err.data?.details || {};
      const mapped = {};
      Object.entries(d).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : String(v); });
      setErrors(mapped);
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const reused = [
    { label: "Mmiliki", value: me.user?.fullName },
    { label: "Simu", value: me.ownerPhone },
    { label: "NIDA na kitambulisho", value: "Vilivyotumika kwenye duka la kwanza" },
    { label: "Akaunti ya malipo", value: me.payoutProvider ? `${me.payoutProvider} · ${me.payoutPhone}${me.payoutAccountName ? ` (${me.payoutAccountName})` : ""}` : "—" },
  ];

  return (
    <Shell me={me} onSignOut={onSignOut}>
      <form onSubmit={submit} noValidate className="mx-auto max-w-2xl">
        <button type="button" onClick={onCancel} className="mb-3 text-sm font-semibold text-slate-500 hover:text-slate-800">← Rudi</button>
        <h1 className="text-2xl font-extrabold text-slate-900">Ongeza Duka Jipya</h1>
        <p className="mb-5 text-sm text-slate-500">Taarifa zako binafsi zinatumika tena. Duka jipya linahitaji leseni na TIN yake, kisha Sipiki litalikagua kabla halijaanza kuuza.</p>

        {formError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</p>}

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-emerald-800"><CheckCircle2 size={16} /> Taarifa zinazotumika tena</h2>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {reused.map((r) => (<div key={r.label}><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{r.label}</dt><dd className="font-semibold text-slate-800">{r.value || "—"}</dd></div>))}
          </dl>
        </section>

        <section className="mt-5 space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900">Duka jipya</h2>
          <div>
            <label htmlFor="n-name" className="text-sm font-semibold text-slate-800">Jina la duka *</label>
            <input id="n-name" className={input(errors.businessName)} value={form.businessName} maxLength={120} onChange={(e) => set("businessName", e.target.value)} />
            <Err k="businessName" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="n-type" className="text-sm font-semibold text-slate-800">Aina ya biashara *</label>
              <select id="n-type" className={input(errors.businessType)} value={form.businessType} onChange={(e) => set("businessType", e.target.value)}>
                <option value="">— Chagua —</option>{BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <Err k="businessType" />
            </div>
            <div>
              <label htmlFor="n-region" className="text-sm font-semibold text-slate-800">Mkoa *</label>
              <select id="n-region" className={input(errors.region)} value={form.region} onChange={(e) => set("region", e.target.value)}>
                <option value="">— Chagua —</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <Err k="region" />
            </div>
          </div>
          <div>
            <label htmlFor="n-loc" className="text-sm font-semibold text-slate-800">Eneo la duka *</label>
            <input id="n-loc" className={input(errors.location)} value={form.location} maxLength={200} placeholder="Mtaa / soko / jengo" onChange={(e) => set("location", e.target.value)} />
            <Err k="location" />
          </div>
          <div>
            <label htmlFor="n-desc" className="text-sm font-semibold text-slate-800">Maelezo <span className="font-normal text-slate-400">(hiari)</span></label>
            <textarea id="n-desc" rows={2} className={input(false)} value={form.description} maxLength={1000} onChange={(e) => set("description", e.target.value)} />
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-800">Makundi ya bidhaa *</legend>
            {cats === null && <p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" /> Inapakia...</p>}
            {cats && cats.length === 0 && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Hakuna kundi linalopokea maombi kwa sasa. Jaribu tena baadaye.</p>}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(cats || []).map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-stone-200 px-3 py-2.5 text-sm hover:border-orange-300">
                  <input type="checkbox" className="h-4 w-4 accent-orange-600" checked={chosen.has(c)} onChange={() => { setErrors((e) => ({ ...e, categories: undefined })); setChosen((p) => { const n = new Set(p); if (n.has(c)) n.delete(c); else n.add(c); return n; }); }} />
                  <span className="font-semibold text-slate-800">{c}</span>
                </label>
              ))}
            </div>
            <Err k="categories" />
          </fieldset>
        </section>

        <section className="mt-5 space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900">Nyaraka za duka hili</h2>
          <div>
            <label htmlFor="n-tin" className="text-sm font-semibold text-slate-800">Namba ya TIN ya duka hili *</label>
            <input id="n-tin" inputMode="numeric" className={input(errors.tin)} value={form.tin} placeholder="123-456-789" maxLength={11} onChange={(e) => set("tin", e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">Kila duka linahitaji TIN yake — isiwe sawa na ya duka lingine.</p>
            <Err k="tin" />
          </div>
          {[["licenseDoc", "Leseni ya biashara ya duka hili *"], ["tinDoc", "Cheti cha TIN cha duka hili *"]].map(([field, label]) => (
            <div key={field}>
              <label htmlFor={`n-${field}`} className="text-sm font-semibold text-slate-800">{label}</label>
              <label htmlFor={`n-${field}`} className={`mt-1 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm hover:border-orange-400 ${errors[field] ? "border-red-400" : "border-stone-300"}`}>
                <Upload size={18} className="flex-shrink-0 text-slate-400" />
                <span className={`min-w-0 truncate ${files[field] ? "font-semibold text-slate-800" : "text-slate-400"}`}>{files[field] ? files[field].name : "Bonyeza kuchagua faili (PDF, JPG au PNG, hadi 5 MB)"}</span>
              </label>
              <input id={`n-${field}`} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => { pickFile(field, e.target.files?.[0] || null); e.target.value = ""; }} />
              <Err k={field} />
            </div>
          ))}
        </section>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-stone-100">Ghairi</button>
          <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
            {busy && <Loader2 size={16} className="animate-spin" />} Tuma Ombi la Duka
          </button>
        </div>
      </form>
    </Shell>
  );
}

// ---- shell + status screens ------------------------------------------------------

function Shell({ me, onSignOut, children, nav }) {
  return (
    <div className="min-h-screen bg-orange-50/40" style={FONT}>
      <header className="border-b-2 border-orange-500 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-3">
            <span className="bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-2xl font-extrabold text-transparent">Sipiki</span>
            <span className="hidden rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white sm:inline">PORTAL YA MUUZAJI</span>
          </Link>
          <div className="flex items-center gap-3">
            <ShopMenu me={me} />
            <button onClick={() => onSignOut()} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">
              <LogOut size={15} /> Toka
            </button>
          </div>
        </div>
        {nav}
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

function StatusCard({ icon: Icon, tone, title, children }) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
      <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${tone}`}><Icon size={32} /></span>
      <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{title}</h1>
      <div className="mt-3 space-y-3 text-sm text-slate-600">{children}</div>
    </div>
  );
}

function Portal({ me, onSignOut, onRefresh }) {
  if (me.status === "active") return <Dashboard me={me} onSignOut={onSignOut} onRefresh={onRefresh} />;

  const date = me.createdAt ? new Date(me.createdAt).toLocaleDateString("sw-TZ", { day: "2-digit", month: "short", year: "numeric" }) : "";
  return (
    <Shell me={me} onSignOut={onSignOut}>
      {me.status === "pending" && (
        <StatusCard icon={Clock} tone="bg-amber-100 text-amber-600" title="Ombi Lako Linakaguliwa">
          <p><b>{me.storeName}</b> — ombi lilitumwa {date}.</p>
          {me.applicationRef && <p className="rounded-xl bg-stone-50 px-4 py-2 font-mono text-sm font-bold text-slate-800">{me.applicationRef}</p>}
          <p>Timu ya Sipiki inakagua nyaraka zako. Tutakutumia ujumbe wa SMS mara tu uamuzi unapotolewa. Ukishaidhinishwa, utaweza kuongeza bidhaa hapa hapa.</p>
          <button onClick={onRefresh} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50">Angalia hali upya</button>
        </StatusCard>
      )}
      {me.status === "rejected" && (
        <StatusCard icon={XCircle} tone="bg-red-100 text-red-600" title="Ombi Halikukubaliwa">
          <p><b>{me.storeName}</b></p>
          {me.rejectionReason && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-700"><b>Sababu:</b> {me.rejectionReason}</p>}
          <p>Wasiliana na Sipiki kwa msaada, au tuma ombi jipya baada ya kurekebisha tatizo lililotajwa.</p>
        </StatusCard>
      )}
      {me.status === "suspended" && (
        <StatusCard icon={Ban} tone="bg-slate-200 text-slate-600" title="Akaunti Imesimamishwa">
          <p><b>{me.storeName}</b> — bidhaa zako hazionekani dukani kwa sasa.</p>
          {me.suspensionReason && <p className="rounded-xl bg-stone-50 px-4 py-3 text-slate-700"><b>Sababu:</b> {me.suspensionReason}</p>}
          <p>Wasiliana na Sipiki ili kutatua suala hili na kurudishwa hewani.</p>
        </StatusCard>
      )}
    </Shell>
  );
}

// ---- dashboard (approved vendors) ------------------------------------------------

function Dashboard({ me, onSignOut, onRefresh }) {
  const [tab, setTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState(null); // null | { product?: existing }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (message) => { setToast(message); setTimeout(() => setToast(null), 3500); };

  const authFailed = useCallback((err) => {
    if (err?.status === 401 || err?.status === 403) { onSignOut("Muda wa kuingia umeisha. Tafadhali ingia tena."); return true; }
    return false;
  }, [onSignOut]);

  const load = useCallback(async () => {
    try {
      const [p, s, c] = await Promise.all([vrequest("/vendors/me/products"), vrequest("/vendors/me/summary"), vrequest("/vendors/me/categories")]);
      setProducts(p.data);
      setSummary(s);
      setCategories(c.data);
      setLoadError("");
    } catch (err) {
      if (!authFailed(err)) setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFailed]);

  useEffect(() => { load(); }, [load]);

  async function toggleVisible(p) {
    if (busy) return;
    setBusy(true);
    try {
      await vrequest(`/vendors/me/products/${p.id}`, { method: "PATCH", body: { isActive: !p.isActive } });
      notify(p.isActive ? `"${p.title}" imefichwa dukani` : `"${p.title}" inaonekana dukani`);
      await load();
    } catch (err) {
      if (!authFailed(err)) notify(err.message);
    } finally { setBusy(false); }
  }

  async function remove(p) {
    if (busy) return;
    setBusy(true);
    try {
      await vrequest(`/vendors/me/products/${p.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      notify(`"${p.title}" imefutwa`);
      await load();
    } catch (err) {
      if (!authFailed(err)) notify(err.message);
    } finally { setBusy(false); }
  }

  const tabs = [
    { key: "overview", label: "Muhtasari", icon: LayoutDashboard },
    { key: "products", label: "Bidhaa", icon: Package, count: products.length },
    { key: "orders", label: "Maagizo", icon: ClipboardList, count: summary?.newOrders || 0 },
    { key: "profile", label: "Wasifu", icon: Store },
  ];
  const nav = (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
      {tabs.map(({ key, label, icon: Icon, count }) => (
        <button key={key} onClick={() => setTab(key)}
          className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === key ? "border-amber-400 text-amber-300" : "border-transparent text-slate-400 hover:text-white"}`}>
          <Icon size={16} /> {label}
          {count > 0 && <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[11px] font-bold text-white">{count}</span>}
        </button>
      ))}
    </nav>
  );

  return (
    <Shell me={me} onSignOut={onSignOut} nav={nav}>
      {loading && <div className="flex justify-center py-20 text-slate-400"><Loader2 className="animate-spin" /></div>}
      {!loading && loadError && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span><button onClick={load} className="font-bold underline">Jaribu tena</button>
        </div>
      )}

      {!loading && tab === "overview" && <Overview me={me} summary={summary} products={products} onAdd={() => { setTab("products"); setEditor({}); }} />}

      {!loading && tab === "products" && (
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Bidhaa Zangu</h1>
              <p className="text-sm text-slate-500">Bidhaa zinazoonekana zinaonyeshwa dukani mara moja.</p>
            </div>
            <button onClick={() => setEditor({})} className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700">
              <Plus size={17} /> Ongeza Bidhaa
            </button>
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
              <Package size={34} className="mx-auto mb-2 text-stone-400" />
              <p className="font-bold text-slate-700">Bado hujaongeza bidhaa</p>
              <p className="mb-4 text-sm text-slate-400">Ongeza bidhaa yako ya kwanza ili wateja waione.</p>
              <button onClick={() => setEditor({})} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700">Ongeza Bidhaa</button>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <li key={p.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <div className="relative flex aspect-[4/3] items-center justify-center bg-stone-100">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageSrc(p.images[0].url, 400)} alt={p.title} className="absolute inset-0 h-full w-full object-cover" />
                    ) : <Package size={36} className="text-stone-300" />}
                    <span className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${p.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                      {p.isActive ? "Inaonekana" : "Imefichwa"}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{p.category?.name}</p>
                    <h3 className="mt-0.5 truncate text-sm font-extrabold text-slate-900" title={p.title}>{p.title}</h3>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-base font-extrabold text-orange-600">{fmt(p.priceTsh)}</span>
                      <span className={`text-xs font-semibold ${p.stockQuantity === 0 ? "text-red-600" : "text-slate-500"}`}>{p.stockQuantity === 0 ? "Imeisha" : `Zipo ${p.stockQuantity}`}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => setEditor({ product: p })} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-300 py-2 text-xs font-bold text-slate-700 hover:bg-stone-50"><Pencil size={13} /> Hariri</button>
                      <button onClick={() => toggleVisible(p)} disabled={busy} title={p.isActive ? "Ficha" : "Onyesha"} className="rounded-lg border border-stone-300 px-3 py-2 text-slate-600 hover:bg-stone-50 disabled:opacity-60">{p.isActive ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      <button onClick={() => setConfirmDelete(p)} title="Futa" className="rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && tab === "orders" && <OrdersTab onAuthError={authFailed} onChanged={load} notify={notify} />}

      {!loading && tab === "profile" && <Profile me={me} products={products} onAuthError={authFailed} notify={notify} onChanged={() => { load(); onRefresh(); }} />}

      {editor && (
        <ProductEditor
          product={editor.product}
          categories={categories}
          onClose={() => setEditor(null)}
          onSaved={async (message) => { setEditor(null); notify(message); await load(); }}
          onAuthError={authFailed}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-extrabold text-slate-900">Futa bidhaa hii?</h3>
            <p className="mt-2 text-sm text-slate-600"><b>{confirmDelete.title}</b> haitaonekana tena dukani. Hatua hii haiwezi kutenduliwa.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-100">Ghairi</button>
              <button onClick={() => remove(confirmDelete)} disabled={busy} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">Futa</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">{toast}</div>}
    </Shell>
  );
}

// ---- orders (customers' orders for this seller's products) --------------------------

const ORDER_STATUS = {
  pending: ["Mpya — inasubiri uthibitisho", "bg-amber-100 text-amber-800"],
  processing: ["Inaandaliwa", "bg-sky-100 text-sky-800"],
  shipped: ["Imetumwa", "bg-indigo-100 text-indigo-800"],
  delivered: ["Imewasilishwa", "bg-emerald-100 text-emerald-800"],
  cancelled: ["Imeghairiwa", "bg-slate-200 text-slate-600"],
};
// the next step the seller can take, and the label of the button
const ORDER_NEXT = {
  pending: { status: "processing", label: "Thibitisha Oda", cls: "bg-emerald-600 hover:bg-emerald-700" },
  processing: { status: "shipped", label: "Imetumwa", cls: "bg-indigo-600 hover:bg-indigo-700" },
  shipped: { status: "delivered", label: "Imewasilishwa", cls: "bg-emerald-600 hover:bg-emerald-700" },
};

function OrdersTab({ onAuthError, onChanged, notify }) {
  const [orders, setOrders] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await vrequest("/vendors/me/orders");
      setOrders(r.data);
      setError("");
    } catch (err) {
      if (!onAuthError(err)) { setError(err.message); setOrders((o) => o || []); }
    }
  }, [onAuthError]);
  useEffect(() => { load(); }, [load]);

  async function change(o, status) {
    if (busyId) return;
    setBusyId(o.id);
    try {
      await vrequest(`/vendors/me/orders/${o.id}/status`, { method: "PATCH", body: { status } });
      notify(status === "cancelled" ? `Oda ${o.ref} imeghairiwa — bidhaa zimerudishwa kwenye stoo` : `Oda ${o.ref}: mteja ametumiwa SMS`);
      setConfirmCancel(null);
      await load();
      onChanged();
    } catch (err) {
      if (!onAuthError(err)) { notify(err.status === 409 ? "Hali ya oda imebadilika tayari. Orodha imesasishwa." : err.message); if (err.status === 409) await load(); }
    } finally { setBusyId(null); }
  }

  const when = (iso) => new Date(iso).toLocaleString("sw-TZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900">Maagizo</h1>
      <p className="text-sm text-slate-500">Wateja wanalipa unapowasilisha bidhaa. Mpigie mteja kupanga uwasilishaji, kisha sasisha hali ya oda.</p>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error} <button onClick={load} className="font-bold underline">Jaribu tena</button></p>}
      {orders === null && <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>}
      {orders && orders.length === 0 && !error && (
        <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
          <ClipboardList size={34} className="mx-auto mb-2 text-stone-400" />
          <p className="font-bold text-slate-700">Hakuna maagizo bado</p>
          <p className="mx-auto max-w-sm text-sm text-slate-400">Mteja akiagiza bidhaa yako, oda itaonekana hapa na utapokea SMS.</p>
        </div>
      )}
      <ul className="mt-5 space-y-4">
        {(orders || []).map((o) => {
          const [label, cls] = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
          const next = ORDER_NEXT[o.status];
          const canCancel = o.status === "pending" || o.status === "processing";
          return (
            <li key={o.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" data-testid="order-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-base font-extrabold text-slate-900">{o.ref}</p>
                  <p className="text-xs text-slate-400">{when(o.createdAt)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{label}</span>
              </div>

              <div className="mt-3 grid gap-3 rounded-xl bg-stone-50 p-3 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2"><Phone size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
                  <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mteja</p>
                    <p className="font-semibold text-slate-800">{o.customer.name || "Hajaandika jina"}</p>
                    <a href={`tel:+${o.customer.phone}`} className="font-bold text-sky-700 hover:underline">+{o.customer.phone}</a></div></div>
                <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
                  <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Uwasilishaji</p>
                    <p className="font-semibold text-slate-800">{o.delivery.location}</p>
                    <p className="text-slate-500">{o.delivery.region}</p></div></div>
              </div>
              {o.delivery.notes && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Maelezo ya mteja: {o.delivery.notes}</p>}

              <ul className="mt-3 divide-y divide-stone-100 text-sm">
                {o.items.map((i, n) => (
                  <li key={n} className="flex justify-between gap-3 py-1.5"><span className="min-w-0 truncate">{i.quantity} × {i.title}</span><span className="flex-shrink-0 font-semibold">{fmt(i.subtotalTsh)}</span></li>
                ))}
                <li className="flex justify-between pt-2 font-extrabold text-slate-900"><span>Jumla ya kukusanya</span><span>{fmt(o.subtotalTsh)}</span></li>
              </ul>

              {(next || canCancel) && (
                <div className="mt-4 flex flex-col gap-2 border-t border-stone-100 pt-4 sm:flex-row">
                  {next && (
                    <button onClick={() => change(o, next.status)} disabled={busyId === o.id} className={`flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 ${next.cls}`}>
                      {busyId === o.id ? <Loader2 size={16} className="animate-spin" /> : next.label}
                    </button>
                  )}
                  {canCancel && (confirmCancel === o.id ? (
                    <button onClick={() => change(o, "cancelled")} disabled={busyId === o.id} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">Ndiyo, ghairi oda</button>
                  ) : (
                    <button onClick={() => setConfirmCancel(o.id)} className="flex-1 rounded-xl border-2 border-red-200 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">Ghairi</button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Overview({ me, summary, products, onAdd }) {
  const hasProduct = products.length > 0;
  const hasPhoto = products.some((p) => p.images.length > 0);
  const live = products.some((p) => p.isActive);
  const steps = [
    { done: true, text: "Biashara yako imeidhinishwa" },
    { done: hasProduct, text: "Ongeza bidhaa yako ya kwanza" },
    { done: hasPhoto, text: "Weka picha nzuri kwenye bidhaa" },
    { done: live, text: "Bidhaa ionekane dukani" },
  ];
  const stat = (icon, label, value, sub, tone) => {
    const Icon = icon;
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span>
        </div>
        <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
        <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
      </div>
    );
  };
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Karibu, {me.user?.fullName?.split(" ")[0] || "Muuzaji"} 👋</h1>
        <p className="text-sm text-slate-500">{me.storeName}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat(Package, "Bidhaa", summary?.products ?? 0, `${summary?.activeProducts ?? 0} zinaonekana dukani`, "bg-sky-100 text-sky-700")}
        {stat(ClipboardList, "Maagizo", summary?.ordersCount ?? 0, summary?.newOrders ? `${summary.newOrders} mapya yanasubiri` : "Yaliyothibitishwa", "bg-amber-100 text-amber-700")}
        {stat(TrendingUp, "Mauzo", fmt(summary?.salesTsh), "Jumla", "bg-emerald-100 text-emerald-700")}
        {stat(Wallet, "Malipo", me.payoutProvider || "—", me.payoutPhone || "", "bg-orange-100 text-orange-700")}
      </div>
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-extrabold text-slate-900">Hatua za Kuanza</h2>
        <ul className="mt-3 space-y-2.5">
          {steps.map((s) => (
            <li key={s.text} className="flex items-center gap-2.5 text-sm">
              {s.done ? <CheckCircle2 size={19} className="text-emerald-500" /> : <Circle size={19} className="text-stone-300" />}
              <span className={s.done ? "text-slate-400 line-through" : "font-semibold text-slate-800"}>{s.text}</span>
            </li>
          ))}
        </ul>
        {!hasProduct && <button onClick={onAdd} className="mt-5 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700">Ongeza Bidhaa</button>}
      </section>
    </div>
  );
}

function CategoriesCard({ me, products, onAuthError, notify, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(null); // names the admin currently accepts for new businesses
  const [chosen, setChosen] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const current = me.categories || [];

  async function start() {
    setError("");
    setChosen(new Set(current.map((c) => c.toLowerCase())));
    setEditing(true);
    try {
      const r = await request("/vendors/categories", { token: null });
      setOpen(r.data);
    } catch { setOpen([]); }
  }

  // every open category, plus the ones the seller already has that the admin has since closed (those can only be removed)
  const lower = (arr) => arr.map((c) => c.toLowerCase());
  const options = open === null ? [] : [
    ...open.map((name) => ({ name, closed: false })),
    ...current.filter((c) => !lower(open).includes(c.toLowerCase())).map((name) => ({ name, closed: true })),
  ];
  const removedNow = current.filter((c) => !chosen.has(c.toLowerCase()));
  const affected = products.filter((p) => p.category && removedNow.some((c) => c.toLowerCase() === p.category.name.toLowerCase())).length;

  function toggle(o) {
    setError("");
    const key = o.name.toLowerCase();
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (!o.closed) next.add(key);
      return next;
    });
  }

  async function save() {
    if (chosen.size === 0) { setError("Chagua angalau kundi moja."); return; }
    setSaving(true);
    try {
      const names = options.filter((o) => chosen.has(o.name.toLowerCase())).map((o) => o.name);
      await vrequest("/vendors/me/categories", { method: "PATCH", body: { categories: names } });
      notify("Makundi yamebadilishwa");
      setEditing(false);
      onChanged();
    } catch (err) {
      if (!onAuthError(err)) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" data-testid="categories-card">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Makundi ya Biashara</h2>
        {!editing && <button onClick={start} className="text-sm font-bold text-sky-700 hover:underline">Badilisha</button>}
      </div>
      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {current.map((c) => <span key={c} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{c}</span>)}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-slate-500">Weka alama kwenye makundi ya bidhaa unazouza. Unaweza kuongeza makundi yaliyo wazi tu. Bidhaa ulizokwisha weka zinabaki.</p>
          {open === null && <p className="mt-3 flex items-center gap-2 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" /> Inapakia...</p>}
          <ul className="mt-3 space-y-2">
            {options.map((o) => (
              <li key={o.name}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5 text-sm hover:border-orange-300">
                  <input type="checkbox" className="h-4 w-4 accent-orange-600" checked={chosen.has(o.name.toLowerCase())} disabled={o.closed && !chosen.has(o.name.toLowerCase())} onChange={() => toggle(o)} />
                  <span className="flex-1 font-semibold text-slate-800">{o.name}</span>
                  {o.closed && <span className="text-[11px] font-semibold text-slate-400">halipokei wapya</span>}
                </label>
              </li>
            ))}
          </ul>
          {affected > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Bidhaa {affected} ziko kwenye makundi unayoondoa. Zitaendelea kuonekana dukani, lakini hutaweza kuongeza bidhaa mpya kwenye makundi hayo.</p>}
          {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-100">Ghairi</button>
            <button onClick={save} disabled={saving || open === null} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">Hifadhi</button>
          </div>
        </div>
      )}
    </section>
  );
}

function Profile({ me, products, onAuthError, notify, onChanged }) {
  const rows = [
    { icon: Store, label: "Biashara", value: `${me.storeName}${me.businessType ? ` · ${me.businessType}` : ""}` },
    { icon: FileText, label: "Namba ya Ombi", value: me.applicationRef || "—" },
    { icon: MapPin, label: "Eneo", value: [me.location, me.region].filter(Boolean).join(", ") || "—" },
    { icon: Phone, label: "Simu", value: me.ownerPhone || "—" },
    { icon: Mail, label: "Barua pepe", value: me.user?.email || "—" },
    { icon: FileText, label: "TIN", value: me.tin || "—" },
    { icon: Wallet, label: "Akaunti ya Malipo", value: me.payoutProvider ? `${me.payoutProvider} · ${me.payoutPhone || ""}${me.payoutAccountName ? ` (${me.payoutAccountName})` : ""}` : "—" },
  ];
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold text-slate-900">Wasifu wa Biashara</h1>
      <p className="mb-5 text-sm text-slate-500">Kubadilisha taarifa zingine (simu, TIN, akaunti ya malipo), wasiliana na Sipiki.</p>
      <dl className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white shadow-sm">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3 px-5 py-3.5">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500"><Icon size={15} /></span>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
              <dd className="break-words text-sm font-semibold text-slate-800">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <CategoriesCard me={me} products={products} onAuthError={onAuthError} notify={notify} onChanged={onChanged} />
    </div>
  );
}

// ---- product editor (add / edit, with photos) ------------------------------------

function ProductEditor({ product, categories, onClose, onSaved, onAuthError }) {
  const editing = Boolean(product);
  const [form, setForm] = useState({
    title: product?.title || "",
    description: product?.description || "",
    priceTsh: product ? String(product.priceTsh) : "",
    stockQuantity: product ? String(product.stockQuantity) : "1",
    categoryId: product?.category?.id || (categories.length === 1 ? categories[0].id : ""),
    isActive: product ? product.isActive : true,
  });
  const [existing, setExisting] = useState(product?.images || []); // photos already saved
  const [removed, setRemoved] = useState([]);                      // saved photos to delete on save
  const [added, setAdded] = useState([]);                          // { file, preview, warnings } picked now
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // release the temporary preview addresses when the dialog closes
  useEffect(() => () => added.forEach((a) => URL.revokeObjectURL(a.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const photoCount = existing.length + added.length;
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  function pickPhotos(e) {
    const files = [...e.target.files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    e.target.value = "";
    const room = MAX_PHOTOS - photoCount;
    const picked = files.slice(0, Math.max(0, room)).map((file) => ({ file, preview: URL.createObjectURL(file), warnings: [] }));
    setAdded((prev) => [...prev, ...picked]);
    // check quality in the background and attach any warnings to each photo
    picked.forEach((a) => checkPhoto(a.file).then((warnings) => {
      if (warnings.length) setAdded((prev) => prev.map((x) => (x.preview === a.preview ? { ...x, warnings } : x)));
    }));
    if (files.length > room) setFormError(`Unaweza kuweka picha ${MAX_PHOTOS} tu kwa kila bidhaa.`);
  }

  function validate() {
    const e = {};
    if (form.title.trim().length < 3) e.title = "Jina liwe na herufi angalau 3";
    const price = Number(form.priceTsh);
    if (!Number.isInteger(price) || price < 100) e.priceTsh = "Weka bei kamili, angalau TSh 100";
    else if (price > 20_000_000) e.priceTsh = "Bei ni kubwa mno";
    const stock = Number(form.stockQuantity);
    if (form.stockQuantity === "" || !Number.isInteger(stock) || stock < 0) e.stockQuantity = "Weka idadi kamili (0 au zaidi)";
    if (!form.categoryId) e.categoryId = "Chagua kundi la bidhaa";
    return e;
  }

  async function save() {
    if (saving) return;
    const e = validate();
    setErrors(e);
    setFormError("");
    if (Object.keys(e).length) return;
    setSaving(true);
    const body = {
      title: form.title.trim(), description: form.description.trim(), priceTsh: Number(form.priceTsh),
      stockQuantity: Number(form.stockQuantity), categoryId: form.categoryId, isActive: form.isActive,
    };
    let saved;
    try {
      saved = editing
        ? (await vrequest(`/vendors/me/products/${product.id}`, { method: "PATCH", body })).product
        : (await vrequest("/vendors/me/products", { method: "POST", body })).product;
    } catch (err) {
      setSaving(false);
      if (onAuthError(err)) return;
      const d = err.data?.details || {};
      setErrors({ title: d.title?.[0], priceTsh: d.priceTsh?.[0], stockQuantity: d.stockQuantity?.[0], categoryId: d.categoryId?.[0] });
      setFormError(err.message);
      return;
    }

    // photos: remove the ones taken off, then upload the new ones one by one
    let failed = 0;
    for (const img of removed) {
      try { await vrequest(`/vendors/me/products/${saved.id}/images/${img.id}`, { method: "DELETE" }); } catch { failed += 1; }
    }
    for (const a of added) {
      try { await uploadProductImage(saved.id, await shrinkImage(a.file)); } catch (err) { if (onAuthError(err)) return; failed += 1; }
    }
    setSaving(false);
    onSaved(failed
      ? `"${saved.title}" imehifadhiwa, lakini picha ${failed} zimeshindikana. Fungua Hariri kuziongeza tena.`
      : editing ? `"${saved.title}" imebadilishwa` : `"${saved.title}" imeongezwa dukani`);
  }

  const input = (err) => `mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-orange-500 ${err ? "border-red-400" : "border-stone-300"}`;
  const Err = ({ k }) => (errors[k] ? <p className="mt-1 text-xs font-medium text-red-600">{errors[k]}</p> : null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-slate-900/50" onClick={saving ? undefined : onClose} />
      <div className="relative my-6 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-extrabold text-slate-900">{editing ? "Hariri Bidhaa" : "Ongeza Bidhaa"}</h3>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        {categories.length === 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">Hakuna kundi la bidhaa lililounganishwa na biashara yako. Wasiliana na Sipiki.</p>
        )}

        <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor="p-title">Jina la Bidhaa</label>
        <input id="p-title" className={input(errors.title)} maxLength={120} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="mf. Dress ya Kitenge Ankara" />
        <Err k="title" />

        <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="p-cat">Kundi</label>
        <select id="p-cat" className={input(errors.categoryId)} value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          <option value="">— Chagua kundi —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Err k="categoryId" />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-800" htmlFor="p-price">Bei (TSh)</label>
            <input id="p-price" inputMode="numeric" className={input(errors.priceTsh)} value={form.priceTsh} onChange={(e) => set("priceTsh", e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="35000" />
            <Err k="priceTsh" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800" htmlFor="p-stock">Idadi iliyopo</label>
            <input id="p-stock" inputMode="numeric" className={input(errors.stockQuantity)} value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value.replace(/\D/g, "").slice(0, 6))} />
            <Err k="stockQuantity" />
          </div>
        </div>

        <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="p-desc">Maelezo (hiari)</label>
        <textarea id="p-desc" rows={3} maxLength={2000} className={input(false)} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ukubwa, rangi, hali ya bidhaa..." />

        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800">Picha <span className="font-normal text-slate-400">({photoCount}/{MAX_PHOTOS})</span></p>
          <div className="mt-2 flex flex-wrap gap-2">
            {existing.map((img) => (
              <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc(img.url, 400)} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Ondoa picha" onClick={() => { setExisting((x) => x.filter((i) => i.id !== img.id)); setRemoved((r) => [...r, img]); }} className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-0.5 text-white"><X size={13} /></button>
              </div>
            ))}
            {added.map((a, i) => (
              <div key={a.preview} className="relative h-20 w-20 overflow-hidden rounded-xl border border-orange-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.preview} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Ondoa picha" onClick={() => { URL.revokeObjectURL(a.preview); setAdded((x) => x.filter((_, j) => j !== i)); }} className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-0.5 text-white"><X size={13} /></button>
              </div>
            ))}
            {photoCount < MAX_PHOTOS && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 text-xs font-semibold text-stone-500 hover:border-orange-400 hover:text-orange-600">
                <ImagePlus size={20} /> Ongeza
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={pickPhotos} />
              </label>
            )}
          </div>
          {added.some((a) => a.warnings.length > 0) && (
            <ul className="mt-2 space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              {added.map((a, i) => a.warnings.map((w) => <li key={`${a.preview}-${w}`}>Picha {existing.length + i + 1}: {w}</li>))}
            </ul>
          )}
          <p className="mt-1 text-xs text-slate-400">Picha ya kwanza ndiyo inayoonekana kwenye orodha. Picha hupunguzwa ukubwa kiotomatiki.</p>
          <details className="mt-2 rounded-xl border border-orange-200 bg-orange-50/60 p-3 text-xs text-slate-700">
            <summary className="cursor-pointer font-bold text-orange-700">Jinsi ya kupiga picha nzuri ya bidhaa</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li><b>Mwanga:</b> piga karibu na dirisha au nje wakati wa mchana. Usitumie flash, na mwanga usiwe nyuma ya bidhaa.</li>
              <li><b>Mandhari:</b> weka bidhaa juu ya shuka jeupe, ukuta mweupe au meza safi. Ondoa vitu vingine.</li>
              <li><b>Picha 3–4:</b> ya kwanza ionyeshe bidhaa nzima mbele. Zingine: upande, nyuma, karibu kuonyesha ubora, na ikitumika.</li>
              <li><b>Ukubwa:</b> bidhaa ijaze sehemu kubwa ya picha. Shika simu wima na usafishe kioo cha kamera.</li>
              <li><b>Ukweli:</b> picha ionyeshe bidhaa halisi unayouza — wateja wanaamini na hawarudishi.</li>
            </ul>
          </details>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-orange-600" />
          Ionekane dukani
        </label>

        {formError && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{formError}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-100">Ghairi</button>
          <button onClick={save} disabled={saving || categories.length === 0} className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
            {saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Inahifadhi..." : "Hifadhi"}
          </button>
        </div>
      </div>
    </div>
  );
}
