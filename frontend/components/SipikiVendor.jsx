"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Package, ClipboardList, Store, LogOut, Lock, Loader2, Plus, X, Pencil, Trash2,
  Eye, EyeOff, ImagePlus, Clock, Ban, XCircle, CheckCircle2, Circle, TrendingUp, Wallet, MapPin, Phone, Mail, FileText,
} from "lucide-react";
import { apiConfigured, request } from "../lib/adminApi";
import { vrequest, getVendorToken, setVendorToken, imageSrc, shrinkImage, uploadProductImage } from "../lib/vendorApi";

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

export default function SipikiVendor() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");

  const signOut = useCallback((message = "") => {
    setVendorToken(null);
    setMe(null);
    setNotice(message);
  }, []);

  const loadMe = useCallback(async () => {
    try {
      setMe(await vrequest("/vendors/me"));
    } catch (err) {
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
  if (!me) return <LoginScreen notice={notice} onSignedIn={() => { setNotice(""); setChecking(true); loadMe(); }} />;
  return <Portal me={me} onSignOut={signOut} onRefresh={loadMe} />;
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
            <span className="hidden max-w-[14rem] truncate text-sm text-slate-300 sm:inline">{me.storeName}</span>
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
  if (me.status === "active") return <Dashboard me={me} onSignOut={onSignOut} />;

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

function Dashboard({ me, onSignOut }) {
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
    { key: "orders", label: "Maagizo", icon: ClipboardList },
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
                      <img src={imageSrc(p.images[0].url)} alt={p.title} className="h-full w-full object-cover" />
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

      {!loading && tab === "orders" && (
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Maagizo</h1>
          <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
            <ClipboardList size={34} className="mx-auto mb-2 text-stone-400" />
            <p className="font-bold text-slate-700">Hakuna maagizo bado</p>
            <p className="mx-auto max-w-sm text-sm text-slate-400">Maagizo ya wateja yataonekana hapa. Ununuzi na malipo ya M-Pesa, Tigo Pesa na Airtel Money bado haujafunguliwa.</p>
          </div>
        </div>
      )}

      {!loading && tab === "profile" && <Profile me={me} />}

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
        {stat(ClipboardList, "Maagizo", summary?.ordersCount ?? 0, "Yaliyolipwa", "bg-amber-100 text-amber-700")}
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

function Profile({ me }) {
  const rows = [
    { icon: Store, label: "Biashara", value: `${me.storeName}${me.businessType ? ` · ${me.businessType}` : ""}` },
    { icon: FileText, label: "Namba ya Ombi", value: me.applicationRef || "—" },
    { icon: MapPin, label: "Eneo", value: [me.location, me.region].filter(Boolean).join(", ") || "—" },
    { icon: Package, label: "Makundi", value: (me.categories || []).join(", ") || "—" },
    { icon: Phone, label: "Simu", value: me.ownerPhone || "—" },
    { icon: Mail, label: "Barua pepe", value: me.user?.email || "—" },
    { icon: FileText, label: "TIN", value: me.tin || "—" },
    { icon: Wallet, label: "Akaunti ya Malipo", value: me.payoutProvider ? `${me.payoutProvider} · ${me.payoutPhone || ""}${me.payoutAccountName ? ` (${me.payoutAccountName})` : ""}` : "—" },
  ];
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold text-slate-900">Wasifu wa Biashara</h1>
      <p className="mb-5 text-sm text-slate-500">Kubadilisha taarifa hizi, wasiliana na Sipiki.</p>
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
  const [added, setAdded] = useState([]);                          // { file, preview } picked now
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
    setAdded((prev) => [...prev, ...files.slice(0, Math.max(0, room)).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
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
                <img src={imageSrc(img.url)} alt="" className="h-full w-full object-cover" />
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
          <p className="mt-1 text-xs text-slate-400">Picha ya kwanza ndiyo inayoonekana kwenye orodha. Picha hupunguzwa ukubwa kiotomatiki.</p>
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
