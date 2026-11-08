"use client";
import Link from "next/link";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  LayoutDashboard, ClipboardCheck, Store, Search, X, Check, FileText, Phone, Mail, MapPin,
  Wallet, Eye, TrendingUp, Clock, Ban, RotateCcw, Banknote, Users, LogOut, Lock, Loader2, Tags, Plus,
} from "lucide-react";
import { apiConfigured, request, fetchDocumentBlob, getToken, setToken } from "../lib/adminApi";

// ============================================================================
// SIPIKI — Admin dashboard
// Tabs: Muhtasari (overview) · Maombi (pending approvals) · Wauzaji (all vendors)
// Works only with the real API (NEXT_PUBLIC_API_URL): admins sign in, and every
// number and action here comes from /api/admin/*. Status changes mirror the
// vendors.status enum:  pending → active (approve) | rejected (reject);  active ⇄ suspended
// ============================================================================


const REJECT_REASONS = [
  "Nyaraka hazisomeki vizuri",
  "Namba ya TIN haioani na jina la biashara",
  "Kitambulisho si sahihi au kimeisha muda",
  "Taarifa za malipo hazioani na jina la mmiliki",
  "Nyingine (eleza hapa chini)",
];

const SUSPEND_REASONS = [
  "Malalamiko mengi kutoka kwa wateja",
  "Kuuza bidhaa zisizoruhusiwa",
  "Kuchelewesha au kutotuma maagizo",
  "Ukiukaji wa masharti ya wauzaji",
  "Nyingine (eleza hapa chini)",
];

const STATUS = {
  pending: { label: "Inasubiri", cls: "bg-amber-100 text-amber-800" },
  active: { label: "Hai", cls: "bg-emerald-100 text-emerald-800" },
  suspended: { label: "Imesimamishwa", cls: "bg-slate-200 text-slate-700" },
  rejected: { label: "Imekataliwa", cls: "bg-red-100 text-red-700" },
};

const fmt = (n) => `TSh ${n.toLocaleString("en-US")}`;
const fmtShort = (n) => (n >= 1_000_000 ? `TSh ${(n / 1_000_000).toFixed(1)}M` : fmt(n));

// ---- small UI pieces -------------------------------------------------------

function Badge({ status }) {
  const s = STATUS[status];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.cls}`}>{s.label}</span>;
}

function StatCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// Reason dialog shared by "reject application" and "suspend vendor"
function ReasonModal({ title, reasons, confirmLabel, confirmCls, onConfirm, onCancel, busy }) {
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function submit() {
    const isOther = reason.startsWith("Nyingine");
    if (isOther && note.trim().length < 5) {
      setError("Eleza sababu kwa ufupi");
      return;
    }
    onConfirm(isOther ? note.trim() : note.trim() ? `${reason} — ${note.trim()}` : reason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <p className="mt-1 text-sm text-slate-500">Muuzaji ataona sababu hii kwenye ujumbe atakaopokea.</p>

        <label className="mt-4 block text-sm font-semibold text-slate-800">Sababu</label>
        <select value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500">
          {reasons.map((r) => <option key={r}>{r}</option>)}
        </select>

        <label className="mt-3 block text-sm font-semibold text-slate-800">Maelezo ya ziada</label>
        <textarea rows={3} value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500" placeholder="Hiari, isipokuwa ukichagua 'Nyingine'" />
        {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-100">Ghairi</button>
          <button onClick={submit} disabled={busy} className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${confirmCls}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Lets the admin correct the categories a business registered under
function CategoryModal({ vendor, options, onSave, onCancel, busy }) {
  const [chosen, setChosen] = useState(() => new Set(vendor.categories.map((c) => c.toLowerCase())));
  const [error, setError] = useState("");

  // Show every known category, plus any old name the vendor has that is no longer in the list
  const known = options.map((o) => o.name);
  const extras = vendor.categories.filter((c) => !known.some((k) => k.toLowerCase() === c.toLowerCase()));
  const all = [...options.map((o) => ({ name: o.name, closed: !o.isActive })), ...extras.map((name) => ({ name, closed: true, unknown: true }))];

  function toggle(name) {
    setError("");
    setChosen((prev) => {
      const next = new Set(prev);
      const key = name.toLowerCase();
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function submit() {
    const names = all.filter((c) => chosen.has(c.name.toLowerCase()) && !c.unknown).map((c) => c.name);
    if (names.length === 0) { setError("Chagua angalau kundi moja"); return; }
    onSave(names);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-extrabold text-slate-900">Badilisha makundi — {vendor.name}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Tumia hii kurekebisha kundi lililochaguliwa kimakosa. Bidhaa zilizokwisha wekwa zinabaki; muuzaji ataweza kuongeza bidhaa mpya kwenye makundi haya tu.
        </p>
        <ul className="mt-4 space-y-2">
          {all.map((c) => (
            <li key={c.name}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5 text-sm hover:border-orange-300">
                <input type="checkbox" checked={chosen.has(c.name.toLowerCase())} onChange={() => toggle(c.name)} disabled={c.unknown && !chosen.has(c.name.toLowerCase())} className="h-4 w-4 accent-orange-600" />
                <span className="flex-1 font-semibold text-slate-800">{c.name}</span>
                {c.unknown && <span className="text-[11px] font-semibold text-red-500">halipo kwenye orodha</span>}
                {!c.unknown && c.closed && <span className="text-[11px] font-semibold text-slate-400">limefungwa kwa usajili</span>}
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-100">Ghairi</button>
          <button onClick={submit} disabled={busy} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">Hifadhi</button>
        </div>
      </div>
    </div>
  );
}

// ---- data helpers ----------------------------------------------------------

// Money is stored in cents (1/100 of a shilling) — show whole shillings
const toTsh = (cents) => Math.round((cents || 0) / 100);

const MONTHS = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"];
function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// API vendor → the shape the screens use
function toVendor(v) {
  return {
    id: v.id,
    name: v.storeName,
    owner: v.user?.fullName || "",
    phone: v.ownerPhone || "",
    email: v.user?.email || "",
    region: v.region || "",
    location: v.location || "",
    type: v.businessType || "",
    categories: v.categories || [],
    status: v.status,
    appliedAt: fmtDate(v.createdAt),
    sales: toTsh(v.salesCents),
    orders: v.itemsSold || 0,
    reason: v.status === "rejected" ? v.rejectionReason : v.status === "suspended" ? v.suspensionReason : undefined,
    docs: (v.documents || []).map((d) => ({ id: d.id, name: d.originalName || d.type })),
    // filled in when an application is opened (the list does not carry these)
    tin: v.tin, payout: v.payoutProvider ? `${v.payoutProvider} · ${v.payoutPhone || ""}` : undefined,
  };
}

// ---- sign-in screen ----------------------------------------------------------

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
      // Only admins may continue; a customer or vendor token is never kept
      if (data.user?.role !== "admin") {
        setError("Akaunti hii haina ruhusa ya kuingia hapa.");
        return;
      }
      setToken(data.token);
      onSignedIn(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-5 flex items-baseline gap-3">
          <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-3xl font-extrabold text-transparent">Sipiki</span>
          <span className="rounded-full bg-sky-700 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white">ADMIN</span>
        </div>
        <h1 className="text-lg font-extrabold text-slate-900">Ingia kama Msimamizi</h1>
        {notice && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{notice}</p>}

        <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor="admin-email">Barua pepe</label>
        <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500" />

        <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="admin-password">Nenosiri</label>
        <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500" />

        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} {busy ? "Inaingia..." : "Ingia"}
        </button>
        <Link href="/" className="mt-4 block text-center text-xs text-slate-400 hover:text-slate-600">← Rudi kwenye duka</Link>
      </form>
    </div>
  );
}

// ---- session wrapper (what the /admin page renders) -------------------------

export default function SipikiAdmin() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");

  const signOut = useCallback((message = "") => {
    setToken(null);
    setAdmin(null);
    setNotice(message);
  }, []);

  // On load: if a token is already stored, confirm with the server that it is still valid and still an admin
  useEffect(() => {
    if (!apiConfigured) { setChecking(false); return; }
    if (!getToken()) { setChecking(false); return; }
    request("/auth/me")
      .then((d) => (d.user?.role === "admin" ? setAdmin(d.user) : signOut()))
      .catch(() => signOut())
      .finally(() => setChecking(false));
  }, [signOut]);

  if (!apiConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
        <div className="max-w-md rounded-2xl bg-white p-7 text-sm text-slate-700 shadow-2xl">
          <h1 className="text-lg font-extrabold text-slate-900">Seva haijaunganishwa</h1>
          <p className="mt-2">Ukurasa huu unahitaji anwani ya API. Weka <code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_API_URL</code> kisha ujenge upya (redeploy) tovuti.</p>
        </div>
      </div>
    );
  }
  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300"><Loader2 className="animate-spin" /></div>;
  }
  if (!admin) return <LoginScreen onSignedIn={(u) => { setNotice(""); setAdmin(u); }} notice={notice} />;
  return <Dashboard admin={admin} onSignOut={signOut} />;
}

// ---- the dashboard -----------------------------------------------------------

function Dashboard({ admin, onSignOut }) {
  const [vendors, setVendors] = useState([]); // every vendor, pending included
  const [serverStats, setServerStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // { kind: 'reject' | 'suspend', id }
  const [catEditId, setCatEditId] = useState(null); // vendor whose categories are being edited
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState(null);

  // A 401 anywhere means the 2-hour token ran out (or the admin was demoted)
  const handleAuthError = useCallback((err) => {
    if (err?.status === 401 || err?.status === 403) {
      onSignOut("Muda wa kuingia umeisha. Tafadhali ingia tena.");
      return true;
    }
    return false;
  }, [onSignOut]);

  const load = useCallback(async () => {
    try {
      const [stats, apps, rest, cats] = await Promise.all([
        request("/admin/stats"),
        request("/admin/applications"),
        request("/admin/vendors?limit=100"),
        request("/admin/categories"),
      ]);
      setServerStats(stats);
      setCategories(cats.data);
      setVendors([...apps.data.map(toVendor), ...rest.data.map(toVendor)]);
      setLoadError("");
    } catch (err) {
      if (!handleAuthError(err)) setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => { load(); }, [load]);

  const pending = useMemo(() => vendors.filter((v) => v.status === "pending"), [vendors]);
  const selected = pending.find((v) => v.id === selectedId) || pending[0] || null;

  // Opening an application loads its detail (TIN, payout account), which the list does not include
  const selectedKey = selected?.id;
  useEffect(() => {
    if (!selectedKey) return;
    request(`/admin/vendors/${selectedKey}`)
      .then((d) =>
        setVendors((prev) => prev.map((v) =>
          v.id === selectedKey
            ? { ...v, tin: d.tin, payout: `${d.payoutProvider || ""} · ${d.payoutPhone || ""}${d.payoutAccountName ? ` (${d.payoutAccountName})` : ""}`, nida: d.nidaMasked, detailLoaded: true }
            : v
        ))
      )
      .catch((err) => { handleAuthError(err); });
  }, [selectedKey, handleAuthError]);

  const stats = useMemo(() => ({
    active: serverStats?.vendors.active ?? 0,
    pending: serverStats?.vendors.pending ?? pending.length,
    totalSales: toTsh(serverStats?.totalSalesCents),
    commission: toTsh(serverStats?.commissionCents),
    orders: serverStats?.ordersCount ?? 0,
  }), [serverStats, pending.length]);

  const filteredVendors = useMemo(
    () =>
      vendors.filter((v) => {
        if (v.status === "pending") return false; // pending live in the Maombi tab
        const matchesStatus = statusFilter === "all" || v.status === statusFilter;
        const q = search.toLowerCase();
        const matchesSearch = !q || v.name.toLowerCase().includes(q) || v.owner.toLowerCase().includes(q) || v.region.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
      }),
    [vendors, search, statusFilter]
  );

  function notify(message) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  // Sends one action to the API, then reloads so the screen shows what the server really holds
  async function act(id, action, body, okMessage) {
    if (busy) return false;
    setBusy(true);
    try {
      await request(`/admin/vendors/${id}/${action}`, { method: "POST", body: body || undefined });
      notify(okMessage);
      await load();
      return true;
    } catch (err) {
      if (!handleAuthError(err)) {
        notify(err.status === 409 ? "Hali ya muuzaji imebadilika tayari. Orodha imesasishwa." : err.message);
        if (err.status === 409) await load();
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  const approve = (v) => act(v.id, "approve", null, `${v.name} imeidhinishwa — SMS imetumwa kwa muuzaji`);
  const reactivate = (v) => act(v.id, "reactivate", null, `${v.name} imerudishwa hewani`);

  async function confirmModal(reason) {
    const v = vendors.find((x) => x.id === modal.id);
    const ok = modal.kind === "reject"
      ? await act(v.id, "reject", { reason }, `Ombi la ${v.name} limekataliwa`)
      : await act(v.id, "suspend", { reason }, `${v.name} imesimamishwa`);
    if (ok) setModal(null);
  }

  // Saves corrected categories for one business
  async function saveVendorCategories(names) {
    if (busy) return;
    setBusy(true);
    try {
      const { categories: saved } = await request(`/admin/vendors/${catEditId}/categories`, { method: "PATCH", body: { categories: names } });
      setVendors((prev) => prev.map((v) => (v.id === catEditId ? { ...v, categories: saved } : v)));
      setCatEditId(null);
      notify("Makundi yamebadilishwa");
    } catch (err) {
      if (!handleAuthError(err)) notify(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Opens or closes a category for new registrations
  async function toggleCategory(c) {
    if (busy) return;
    setBusy(true);
    try {
      const { category } = await request(`/admin/categories/${c.id}`, { method: "PATCH", body: { isActive: !c.isActive } });
      setCategories((prev) => prev.map((x) => (x.id === category.id ? category : x)));
      notify(category.isActive ? `"${category.name}" sasa iko wazi kwa usajili` : `"${category.name}" imefungwa kwa usajili`);
    } catch (err) {
      if (!handleAuthError(err)) notify(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(e) {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const { category } = await request("/admin/categories", { method: "POST", body: { name } });
      setCategories((prev) => [...prev, category]);
      setNewCategory("");
      notify(`"${category.name}" imeongezwa`);
    } catch (err) {
      if (!handleAuthError(err)) notify(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Documents need the token, so fetch as a file and open it from a temporary local address.
  // The tab is opened first (inside the click) so the browser doesn't block it as a pop-up.
  async function openDoc(vendorId, doc) {
    const tabRef = window.open("", "_blank");
    try {
      const blob = await fetchDocumentBlob(vendorId, doc.id);
      const url = URL.createObjectURL(blob);
      if (tabRef) tabRef.location.href = url; else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      if (tabRef) tabRef.close();
      if (!handleAuthError(err)) notify(err.message);
    }
  }

  const tabs = [
    { key: "overview", label: "Muhtasari", icon: LayoutDashboard },
    { key: "applications", label: "Maombi", icon: ClipboardCheck, count: pending.length },
    { key: "vendors", label: "Wauzaji", icon: Store },
    { key: "categories", label: "Makundi", icon: Tags },
  ];

  const modalVendor = modal ? vendors.find((v) => v.id === modal.id) : null;

  return (
    <div className="min-h-screen bg-orange-50/40" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* ---------------- Header ---------------- */}
      <header className="border-b-2 border-orange-500 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-3">
            <span className="bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-2xl font-extrabold text-transparent">Sipiki</span>
            <span className="rounded-full bg-sky-700 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white">ADMIN</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-300 sm:inline">Karibu, {admin.fullName}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-sm font-extrabold text-slate-900">{(admin.fullName || "A").charAt(0).toUpperCase()}</span>
            <button onClick={() => onSignOut()} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">
              <LogOut size={15} /> Toka
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === key ? "border-amber-400 text-amber-300" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {label}
              {count > 0 && <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[11px] font-bold text-white">{count}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {loading && <div className="flex justify-center py-20 text-slate-400"><Loader2 className="animate-spin" /></div>}
        {!loading && loadError && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{loadError}</span>
            <button onClick={load} className="font-bold underline">Jaribu tena</button>
          </div>
        )}
        {/* ================= Overview ================= */}
        {!loading && tab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={Store} label="Wauzaji Hai" value={stats.active} sub="Wanaouza sasa hivi" tone="bg-emerald-100 text-emerald-700" />
              <StatCard icon={Clock} label="Maombi Yanayosubiri" value={stats.pending} sub="Yanasubiri ukaguzi" tone="bg-amber-100 text-amber-700" />
              <StatCard icon={TrendingUp} label="Jumla ya Mauzo" value={fmtShort(stats.totalSales)} sub={`Maagizo ${stats.orders}`} tone="bg-sky-100 text-sky-700" />
              <StatCard icon={Banknote} label="Kamisheni (10%)" value={fmtShort(stats.commission)} sub="Mapato ya Sipiki" tone="bg-orange-100 text-orange-700" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent applications */}
              <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900">Maombi ya Hivi Karibuni</h2>
                  <button onClick={() => setTab("applications")} className="text-sm font-semibold text-orange-600 hover:underline">Tazama yote</button>
                </div>
                {pending.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">Hakuna maombi yanayosubiri 🎉</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {pending.slice(0, 4).map((v) => (
                      <li key={v.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{v.name}</p>
                          <p className="text-xs text-slate-500">{v.region} · {v.appliedAt}</p>
                        </div>
                        <button onClick={() => { setSelectedId(v.id); setTab("applications"); }} className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100">
                          Kagua
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Top vendors */}
              <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-base font-extrabold text-slate-900">Wauzaji Bora kwa Mauzo</h2>
                <ul className="space-y-3">
                  {[...vendors].filter((v) => v.sales > 0).sort((a, b) => b.sales - a.sales).slice(0, 5).map((v, i, arr) => (
                    <li key={v.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-800">{i + 1}. {v.name}</span>
                        <span className="font-bold text-slate-900">{fmtShort(v.sales)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${(v.sales / arr[0].sales) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}

        {/* ================= Applications ================= */}
        {!loading && tab === "applications" && (
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Maombi ya Biashara</h1>
            <p className="mb-6 text-sm text-slate-500">Kagua nyaraka kisha idhinisha au kataa kila ombi.</p>

            {pending.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
                <Check size={32} className="mx-auto mb-2 text-emerald-500" />
                <p className="font-bold text-slate-700">Maombi yote yamekaguliwa</p>
                <p className="text-sm text-slate-400">Hakuna kitu kinachosubiri kwa sasa.</p>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-5">
                {/* Queue */}
                <ul className="space-y-2 lg:col-span-2">
                  {pending.map((v) => (
                    <li key={v.id}>
                      <button
                        onClick={() => setSelectedId(v.id)}
                        className={`w-full rounded-xl border bg-white p-4 text-left transition hover:shadow-md ${
                          selected?.id === v.id ? "border-orange-500 ring-2 ring-orange-200" : "border-stone-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-extrabold text-slate-900">{v.name}</p>
                          <span className="text-[11px] text-slate-400">{v.appliedAt}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{v.owner}</p>
                        <p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} /> {v.region}</p>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Detail */}
                {selected && (
                  <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-extrabold text-slate-900">{selected.name}</h2>
                        <p className="text-sm text-slate-500">{selected.type} · imetumwa {selected.appliedAt}</p>
                      </div>
                      <Badge status="pending" />
                    </div>

                    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                      {[
                        { icon: Users, label: "Mmiliki", value: selected.owner },
                        { icon: Phone, label: "Simu", value: selected.phone },
                        { icon: Mail, label: "Barua pepe", value: selected.email },
                        { icon: MapPin, label: "Eneo", value: `${selected.location}, ${selected.region}` },
                        { icon: FileText, label: "TIN", value: selected.tin || "…" },
                        { icon: FileText, label: "NIDA", value: selected.nida || "…" },
                        { icon: Wallet, label: "Malipo", value: selected.payout || "…" },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500"><Icon size={15} /></span>
                          <div className="min-w-0">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                            <dd className="break-words font-semibold text-slate-800">{value}</dd>
                          </div>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Makundi ya Bidhaa</p>
                        <button onClick={() => setCatEditId(selected.id)} className="text-xs font-bold text-sky-700 hover:underline">Badilisha</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.categories.map((c) => (
                          <span key={c} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{c}</span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nyaraka</p>
                      <ul className="space-y-2">
                        {selected.docs.length === 0 && <li className="text-sm text-slate-400">Hakuna nyaraka.</li>}
                        {selected.docs.map((d) => (
                          <li key={d.id} className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2.5">
                            <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                              <FileText size={16} className="flex-shrink-0 text-slate-400" />
                              <span className="truncate">{d.name}</span>
                            </span>
                            <button onClick={() => openDoc(selected.id, d)} className="flex items-center gap-1 text-xs font-bold text-sky-700 hover:underline"><Eye size={14} /> Tazama</button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 flex flex-col gap-2 border-t border-stone-100 pt-5 sm:flex-row">
                      <button onClick={() => approve(selected)} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                        <Check size={17} /> Idhinisha
                      </button>
                      <button onClick={() => setModal({ kind: "reject", id: selected.id })} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-200 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50">
                        <X size={17} /> Kataa
                      </button>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= Vendors ================= */}
        {!loading && tab === "vendors" && (
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Wauzaji Wote</h1>
            <p className="mb-5 text-sm text-slate-500">Simamia akaunti za wauzaji waliosajiliwa.</p>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5">
                <Search size={17} className="text-stone-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tafuta muuzaji, mmiliki au mkoa..." className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400" />
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {[["all", "Wote"], ["active", "Hai"], ["suspended", "Imesimamishwa"], ["rejected", "Imekataliwa"]].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                      statusFilter === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-stone-200 hover:ring-stone-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Biashara</th>
                    <th className="px-4 py-3">Mkoa</th>
                    <th className="px-4 py-3 text-right">Mauzo</th>
                    <th className="px-4 py-3 text-right">Maagizo</th>
                    <th className="px-4 py-3">Hali</th>
                    <th className="px-4 py-3 text-right">Hatua</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredVendors.map((v) => (
                    <tr key={v.id} className="hover:bg-orange-50/30">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{v.name}</p>
                        <p className="text-xs text-slate-500">{v.owner}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-1">
                          {v.categories.map((c) => (
                            <span key={c} className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">{c}</span>
                          ))}
                          <button onClick={() => setCatEditId(v.id)} className="text-[11px] font-bold text-sky-700 hover:underline">Badilisha</button>
                        </p>
                        {v.reason &&<p className="mt-0.5 max-w-xs text-[11px] text-red-500">Sababu: {v.reason}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{v.region}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(v.sales)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{v.orders}</td>
                      <td className="px-4 py-3"><Badge status={v.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {v.status === "active" && (
                          <button onClick={() => setModal({ kind: "suspend", id: v.id })} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                            <Ban size={13} /> Simamisha
                          </button>
                        )}
                        {v.status === "suspended" && (
                          <button onClick={() => reactivate(v)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                            <RotateCcw size={13} /> Rudisha
                          </button>
                        )}
                        {v.status === "rejected" && <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                  {filteredVendors.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Hakuna wauzaji waliopatikana.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ================= Categories ================= */}
        {!loading && tab === "categories" && (
          <div className="max-w-2xl">
            <h1 className="text-2xl font-extrabold text-slate-900">Makundi ya Biashara</h1>
            <p className="mb-5 text-sm text-slate-500">
              Chagua makundi yanayoonekana kwenye fomu ya usajili. Kundi lililofungwa halipokei maombi mapya; wauzaji waliokwisha sajiliwa hawaathiriwi.
              Ukifunga yote, usajili wote umefungwa.
            </p>

            <form onSubmit={addCategory} className="mb-4 flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                maxLength={80}
                placeholder="Ongeza kundi jipya, mf. Vyakula"
                className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-500"
              />
              <button type="submit" disabled={busy || newCategory.trim().length < 2} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">
                <Plus size={16} /> Ongeza
              </button>
            </form>

            <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className={`text-sm font-bold ${c.isActive ? "text-slate-900" : "text-slate-400"}`}>{c.name}</p>
                    <p className={`text-xs ${c.isActive ? "text-emerald-600" : "text-slate-400"}`}>{c.isActive ? "Wazi kwa usajili" : "Imefungwa"}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={c.isActive}
                    aria-label={`${c.name}: ${c.isActive ? "funga" : "fungua"}`}
                    onClick={() => toggleCategory(c)}
                    disabled={busy}
                    className={`relative h-6 w-11 rounded-full transition ${c.isActive ? "bg-emerald-500" : "bg-stone-300"} disabled:opacity-60`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${c.isActive ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </li>
              ))}
              {categories.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">Hakuna makundi bado.</li>}
            </ul>
            {categories.length > 0 && categories.every((c) => !c.isActive) && (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">Makundi yote yamefungwa — usajili wa wauzaji umefungwa kwa sasa.</p>
            )}
          </div>
        )}
      </main>

      {/* Modal + toast */}
      {modal && (
        <ReasonModal
          title={modal.kind === "reject" ? `Kataa ombi la ${modalVendor.name}` : `Simamisha ${modalVendor.name}`}
          reasons={modal.kind === "reject" ? REJECT_REASONS : SUSPEND_REASONS}
          confirmLabel={modal.kind === "reject" ? "Kataa Ombi" : "Simamisha"}
          confirmCls="bg-red-600 hover:bg-red-700"
          busy={busy}
          onConfirm={confirmModal}
          onCancel={() => setModal(null)}
        />
      )}
      {catEditId && vendors.find((v) => v.id === catEditId) && (
        <CategoryModal
          vendor={vendors.find((v) => v.id === catEditId)}
          options={categories}
          busy={busy}
          onSave={saveVendorCategories}
          onCancel={() => setCatEditId(null)}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}
