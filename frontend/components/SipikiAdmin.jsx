"use client";
import Link from "next/link";
import { useState, useMemo } from "react";
import {
  LayoutDashboard, ClipboardCheck, Store, Search, X, Check, FileText, Phone, Mail, MapPin,
  Wallet, Eye, TrendingUp, Clock, Ban, RotateCcw, Banknote, Users,
} from "lucide-react";

// ============================================================================
// SIPIKI — Admin dashboard
// Tabs: Muhtasari (overview) · Maombi (pending approvals) · Wauzaji (all vendors)
// State changes here mirror the vendors.status enum in the schema:
//   pending → active (approve) | rejected (reject);  active ⇄ suspended
// In the real app each action is PATCH /api/admin/vendors/:id/status.
// ============================================================================

const COMMISSION_RATE = 0.1; // matches vendors.commission_rate default (10%)

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

const INITIAL_VENDORS = [
  { id: "v1", name: "Amina Fashion", owner: "Amina Juma Mrisho", phone: "0712 345 678", email: "amina@aminafashion.co.tz", region: "Dar es Salaam", location: "Kariakoo, Mtaa wa Sikukuu", type: "Mtu Binafsi", categories: ["Mavazi"], tin: "123-456-789", payout: "M-Pesa · 0712 345 678", status: "active", appliedAt: "02 Sep 2026", sales: 4850000, orders: 142 },
  { id: "v2", name: "Tech Hub Kariakoo", owner: "Said Omari Bakari", phone: "0754 221 908", email: "info@techhubkko.co.tz", region: "Dar es Salaam", location: "Kariakoo, Mtaa wa Congo", type: "Kampuni (Ltd)", categories: ["Simu na Vifaa"], tin: "208-114-337", payout: "Tigo Pesa · 0714 880 241", status: "active", appliedAt: "28 Aug 2026", sales: 18900000, orders: 96 },
  { id: "v3", name: "Juma Shoes", owner: "Juma Hamisi Selemani", phone: "0765 410 322", email: "jumashoes@gmail.com", region: "Arusha", location: "Soko Kuu, Arusha", type: "Mtu Binafsi", categories: ["Viatu"], tin: "311-902-445", payout: "Airtel Money · 0685 410 322", status: "active", appliedAt: "05 Sep 2026", sales: 2310000, orders: 58 },
  { id: "v4", name: "Zawadi Beauty", owner: "Zawadi Peter Mwakyusa", phone: "0713 556 019", email: "zawadi@zawadibeauty.co.tz", region: "Mbeya", location: "Soko la Mwanjelwa", type: "Mtu Binafsi", categories: ["Urembo"], tin: "187-660-214", payout: "M-Pesa · 0713 556 019", status: "suspended", appliedAt: "11 Aug 2026", sales: 1120000, orders: 47 },
  { id: "v5", name: "Kariakoo Leather", owner: "Hassan Ali Mkwawa", phone: "0719 004 873", email: "kleather@yahoo.com", region: "Dar es Salaam", location: "Kariakoo, Mtaa wa Narung'ombe", type: "Ushirika / Kikundi", categories: ["Mikoba na Vifaa", "Viatu"], tin: "455-120-908", payout: "M-Pesa · 0719 004 873", status: "active", appliedAt: "19 Sep 2026", sales: 3260000, orders: 77 },
  // ---- Pending applications ----
  { id: "v6", name: "Neema Collections", owner: "Neema Daniel Kimaro", phone: "0752 118 640", email: "neema.collections@gmail.com", region: "Kilimanjaro", location: "Moshi Mjini, Soko Kuu", type: "Mtu Binafsi", categories: ["Mavazi", "Mikoba na Vifaa"], tin: "532-771-016", payout: "Tigo Pesa · 0652 118 640", status: "pending", appliedAt: "14 Okt 2026", sales: 0, orders: 0, docs: ["Kitambulisho (NIDA).pdf", "Leseni ya Biashara.pdf", "Cheti cha TIN.jpg"] },
  { id: "v7", name: "Mobile Zone Mwanza", owner: "Baraka Samson Lukiko", phone: "0768 903 214", email: "baraka@mobilezone.co.tz", region: "Mwanza", location: "Nyamagana, Mtaa wa Kenyatta", type: "Kampuni (Ltd)", categories: ["Simu na Vifaa"], tin: "260-415-873", payout: "M-Pesa · 0768 903 214", status: "pending", appliedAt: "14 Okt 2026", sales: 0, orders: 0, docs: ["Pasipoti.jpg", "BRELA Certificate.pdf", "TIN Certificate.pdf"] },
  { id: "v8", name: "Mama Fatuma Store", owner: "Fatuma Rashid Mussa", phone: "0715 667 820", email: "mamafatuma@gmail.com", region: "Dodoma", location: "Soko Kuu la Majengo", type: "Mtu Binafsi", categories: ["Mavazi"], tin: "398-052-661", payout: "Airtel Money · 0786 667 820", status: "pending", appliedAt: "13 Okt 2026", sales: 0, orders: 0, docs: ["NIDA.jpg", "Leseni.pdf", "TIN.pdf"] },
  { id: "v9", name: "Urembo wa Pwani", owner: "Mwanaidi Khamis Juma", phone: "0777 340 195", email: "urembopwani@gmail.com", region: "Unguja Mjini Magharibi", location: "Darajani, Zanzibar", type: "Mtu Binafsi", categories: ["Urembo"], tin: "144-309-572", payout: "M-Pesa · 0777 340 195", status: "pending", appliedAt: "12 Okt 2026", sales: 0, orders: 0, docs: ["Kitambulisho.jpg", "Leseni ya Biashara.pdf", "TIN.jpg"] },
  { id: "v10", name: "Sole Mates", owner: "Daudi Elias Mushi", phone: "0743 887 054", email: "solemates.tz@gmail.com", region: "Dar es Salaam", location: "Mlimani City, Sinza", type: "Mtu Binafsi", categories: ["Viatu"], tin: "611-248-390", payout: "Tigo Pesa · 0713 887 054", status: "rejected", appliedAt: "03 Okt 2026", sales: 0, orders: 0, reason: "Namba ya TIN haioani na jina la biashara" },
];

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
function ReasonModal({ title, reasons, confirmLabel, confirmCls, onConfirm, onCancel }) {
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
          <button onClick={submit} className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white ${confirmCls}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ---- main component --------------------------------------------------------

export default function SipikiAdmin() {
  const [vendors, setVendors] = useState(INITIAL_VENDORS);
  const [tab, setTab] = useState("overview");
  const [selectedId, setSelectedId] = useState("v6");
  const [modal, setModal] = useState(null); // { kind: 'reject' | 'suspend', id }
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState(null);

  const pending = vendors.filter((v) => v.status === "pending");
  const selected = pending.find((v) => v.id === selectedId) || pending[0] || null;

  const stats = useMemo(() => {
    const active = vendors.filter((v) => v.status === "active");
    const totalSales = vendors.reduce((s, v) => s + v.sales, 0);
    return {
      active: active.length,
      pending: pending.length,
      totalSales,
      commission: Math.round(totalSales * COMMISSION_RATE),
      orders: vendors.reduce((s, v) => s + v.orders, 0),
    };
  }, [vendors, pending.length]);

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
    setTimeout(() => setToast(null), 2500);
  }

  // Applies a status change (the real app would PATCH the API here)
  function updateStatus(id, status, reason) {
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, status, reason: reason || undefined } : v)));
  }

  function approve(v) {
    updateStatus(v.id, "active");
    notify(`${v.name} imeidhinishwa — SMS imetumwa kwa muuzaji`);
  }

  function confirmModal(reason) {
    const v = vendors.find((x) => x.id === modal.id);
    if (modal.kind === "reject") {
      updateStatus(v.id, "rejected", reason);
      notify(`Ombi la ${v.name} limekataliwa`);
    } else {
      updateStatus(v.id, "suspended", reason);
      notify(`${v.name} imesimamishwa`);
    }
    setModal(null);
  }

  function reactivate(v) {
    updateStatus(v.id, "active");
    notify(`${v.name} imerudishwa hewani`);
  }

  const tabs = [
    { key: "overview", label: "Muhtasari", icon: LayoutDashboard },
    { key: "applications", label: "Maombi", icon: ClipboardCheck, count: pending.length },
    { key: "vendors", label: "Wauzaji", icon: Store },
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
            <span className="hidden text-sm text-slate-300 sm:inline">Karibu, Msimamizi</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-sm font-extrabold text-slate-900">A</span>
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
        {/* ================= Overview ================= */}
        {tab === "overview" && (
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
        {tab === "applications" && (
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
                        { icon: FileText, label: "TIN", value: selected.tin },
                        { icon: Wallet, label: "Malipo", value: selected.payout },
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
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Makundi ya Bidhaa</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.categories.map((c) => (
                          <span key={c} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{c}</span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nyaraka</p>
                      <ul className="space-y-2">
                        {selected.docs.map((d) => (
                          <li key={d} className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2.5">
                            <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                              <FileText size={16} className="flex-shrink-0 text-slate-400" />
                              <span className="truncate">{d}</span>
                            </span>
                            <button className="flex items-center gap-1 text-xs font-bold text-sky-700 hover:underline"><Eye size={14} /> Tazama</button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 flex flex-col gap-2 border-t border-stone-100 pt-5 sm:flex-row">
                      <button onClick={() => approve(selected)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">
                        <Check size={17} /> Idhinisha
                      </button>
                      <button onClick={() => setModal({ kind: "reject", id: selected.id })} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-200 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50">
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
        {tab === "vendors" && (
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
                        {v.reason && <p className="mt-0.5 max-w-xs text-[11px] text-red-500">Sababu: {v.reason}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{v.region}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(v.sales)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{v.orders}</td>
                      <td className="px-4 py-3"><Badge status={v.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {v.status === "active" && (
                          <button onClick={() => setModal({ kind: "suspend", id: v.id })} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                            <Ban size={13} /> Simamisha
                          </button>
                        )}
                        {v.status === "suspended" && (
                          <button onClick={() => reactivate(v)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
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
      </main>

      {/* Modal + toast */}
      {modal && (
        <ReasonModal
          title={modal.kind === "reject" ? `Kataa ombi la ${modalVendor.name}` : `Simamisha ${modalVendor.name}`}
          reasons={modal.kind === "reject" ? REJECT_REASONS : SUSPEND_REASONS}
          confirmLabel={modal.kind === "reject" ? "Kataa Ombi" : "Simamisha"}
          confirmCls="bg-red-600 hover:bg-red-700"
          onConfirm={confirmModal}
          onCancel={() => setModal(null)}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}
