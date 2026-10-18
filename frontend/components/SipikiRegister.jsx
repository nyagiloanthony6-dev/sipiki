"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Store, User, Wallet, FileText, Check, ChevronLeft, ChevronRight, Upload, ShieldCheck,
  TrendingUp, Truck, BadgePercent, CheckCircle2, Clock, X,
} from "lucide-react";

// ============================================================================
// SIPIKI — Business (vendor) registration
// 4-step wizard: Biashara → Mmiliki → Malipo → Nyaraka, then a success screen.
// On submit the payload maps to: users (role=vendor) + vendors (status='pending').
// An admin then approves/rejects it from the admin dashboard.
// ============================================================================

const REGIONS = [
  "Arusha", "Dar es Salaam", "Dodoma", "Geita", "Iringa", "Kagera", "Katavi", "Kigoma", "Kilimanjaro",
  "Lindi", "Manyara", "Mara", "Mbeya", "Morogoro", "Mtwara", "Mwanza", "Njombe", "Pemba Kaskazini",
  "Pemba Kusini", "Pwani", "Rukwa", "Ruvuma", "Shinyanga", "Simiyu", "Singida", "Songwe", "Tabora",
  "Tanga", "Unguja Kaskazini", "Unguja Kusini", "Unguja Mjini Magharibi",
];

const BUSINESS_TYPES = ["Mtu Binafsi", "Kampuni (Ltd)", "Ushirika / Kikundi"];

const CATEGORIES = ["Mavazi", "Simu na Vifaa", "Viatu", "Urembo", "Mikoba na Vifaa"];

const PAYOUT_PROVIDERS = ["M-Pesa", "Tigo Pesa", "Airtel Money", "HaloPesa"];

const STEPS = [
  { key: "business", label: "Biashara", icon: Store },
  { key: "owner", label: "Mmiliki", icon: User },
  { key: "payout", label: "Malipo", icon: Wallet },
  { key: "docs", label: "Nyaraka", icon: FileText },
];

const DOCS = [
  { key: "idDoc", label: "Kitambulisho cha Mmiliki", hint: "NIDA, leseni ya udereva au pasipoti" },
  { key: "licenseDoc", label: "Leseni ya Biashara / BRELA", hint: "PDF au picha" },
  { key: "tinDoc", label: "Cheti cha TIN", hint: "PDF au picha" },
];

// ---- helpers ---------------------------------------------------------------

// Returns the 9-digit national number (e.g. 712345678) or null if invalid.
function nationalPhone(raw) {
  const d = String(raw).replace(/\D/g, "");
  if (/^255[67]\d{8}$/.test(d)) return d.slice(3);
  if (/^0[67]\d{8}$/.test(d)) return d.slice(1);
  if (/^[67]\d{8}$/.test(d)) return d;
  return null;
}

// 123456789 -> 123-456-789
function formatTin(raw) {
  const d = raw.replace(/\D/g, "").slice(0, 9);
  return d.replace(/(\d{3})(?=\d)/g, "$1-");
}

// Backend URL. When NEXT_PUBLIC_API_URL is set, "Tuma Ombi" posts to POST /api/vendors/register.
// When it isn't (e.g. a quick preview), the form runs in demo mode and fakes a reference number.
const API_URL = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL) || "";

async function submitApplication(f) {
  const body = new FormData();
  const text = {
    businessName: f.businessName, businessType: f.businessType, region: f.region, location: f.location,
    categories: JSON.stringify(f.categories), description: f.description,
    ownerName: f.ownerName, phone: f.phone, email: f.email, nida: f.nida, tin: f.tin, password: f.password,
    payoutProvider: f.payoutProvider, payoutPhone: f.payoutPhone, payoutName: f.payoutName, terms: String(f.terms),
  };
  Object.entries(text).forEach(([k, v]) => body.append(k, v));
  DOCS.forEach((d) => body.append(d.key, f[d.key])); // idDoc, licenseDoc, tinDoc

  // No Content-Type header: the browser adds the multipart boundary itself
  const res = await fetch(`${API_URL}/vendors/register`, { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Imeshindikana kutuma ombi. Jaribu tena.");
  return data.applicationRef;
}

const INITIAL = {
  businessName: "", businessType: "", region: "", location: "", categories: [], description: "",
  ownerName: "", phone: "", email: "", nida: "", tin: "", password: "", confirmPassword: "",
  payoutProvider: "", payoutPhone: "", payoutName: "",
  idDoc: null, licenseDoc: null, tinDoc: null, terms: false,
};

// Returns an { field: message } object for the given step — empty means valid.
function validate(stepKey, f) {
  const e = {};
  if (stepKey === "business") {
    if (f.businessName.trim().length < 3) e.businessName = "Andika jina la biashara (angalau herufi 3)";
    if (!f.businessType) e.businessType = "Chagua aina ya biashara";
    if (!f.region) e.region = "Chagua mkoa";
    if (f.location.trim().length < 3) e.location = "Andika eneo la duka (mf. Kariakoo, Mtaa wa Sikukuu)";
    if (f.categories.length === 0) e.categories = "Chagua angalau kundi moja la bidhaa";
  }
  if (stepKey === "owner") {
    if (f.ownerName.trim().split(/\s+/).length < 2) e.ownerName = "Andika majina yako kamili";
    if (!nationalPhone(f.phone)) e.phone = "Namba si sahihi (mf. 0712 345 678)";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Barua pepe si sahihi";
    if (f.nida.replace(/\D/g, "").length !== 20) e.nida = "Namba ya NIDA ina tarakimu 20";
    if (f.tin.replace(/\D/g, "").length !== 9) e.tin = "TIN ina tarakimu 9";
    if (f.password.length < 8) e.password = "Nenosiri liwe na herufi angalau 8";
    if (f.confirmPassword !== f.password) e.confirmPassword = "Manenosiri hayafanani";
  }
  if (stepKey === "payout") {
    if (!f.payoutProvider) e.payoutProvider = "Chagua mtandao wa malipo";
    if (!nationalPhone(f.payoutPhone)) e.payoutPhone = "Namba si sahihi (mf. 0712 345 678)";
    if (f.payoutName.trim().length < 3) e.payoutName = "Andika jina kama linavyoonekana kwenye namba";
  }
  if (stepKey === "docs") {
    DOCS.forEach((d) => { if (!f[d.key]) e[d.key] = "Pakia nyaraka hii"; });
    if (!f.terms) e.terms = "Lazima ukubali masharti ili kuendelea";
  }
  return e;
}

// ---- small UI pieces -------------------------------------------------------

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls = (error) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 ${
    error ? "border-red-400" : "border-stone-300"
  }`;

function Stepper({ current }) {
  return (
    <ol className="mb-8 flex items-center">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : active
                    ? "border-orange-500 bg-orange-500 text-white shadow-md"
                    : "border-stone-300 bg-white text-stone-400"
                }`}
              >
                {done ? <Check size={18} /> : <Icon size={17} />}
              </span>
              <span className={`mt-1.5 text-[11px] font-semibold ${active ? "text-orange-600" : done ? "text-emerald-600" : "text-stone-400"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={`mx-2 mb-5 h-0.5 flex-1 rounded ${i < current ? "bg-emerald-400" : "bg-stone-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function FileInput({ label, hint, file, error, onChange }) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-800">{label}</p>
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition hover:border-orange-400 hover:bg-orange-50/50 ${
          error ? "border-red-400" : file ? "border-emerald-400 bg-emerald-50/50" : "border-stone-300"
        }`}
      >
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${file ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
          {file ? <CheckCircle2 size={20} /> : <Upload size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-700">{file ? file.name : "Bonyeza kupakia faili"}</span>
          <span className="block text-xs text-slate-400">{hint}</span>
        </span>
        <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </label>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

// ---- main component --------------------------------------------------------

export default function SipikiRegister() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(null); // reference number once submitted
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleCategory = (cat) =>
    set("categories", form.categories.includes(cat) ? form.categories.filter((c) => c !== cat) : [...form.categories, cat]);

  async function next() {
    const e = validate(STEPS[step].key, form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Final submit → POST /api/vendors/register: creates the user (role='vendor'), a vendors
    // row with status='pending', stores the documents, and texts the applicant a confirmation.
    setSubmitting(true);
    setSubmitError("");
    try {
      const ref = API_URL
        ? await submitApplication(form)
        : `SPK-2026-${String(Math.floor(100000 + Math.random() * 900000))}`; // demo mode, no backend
      setSubmitted(ref);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function back() {
    setErrors({});
    setStep(Math.max(0, step - 1));
  }

  // ---------------- Success screen ----------------
  if (submitted) {
    return (
      <div className="min-h-screen bg-orange-50/40" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <Header />
        <main className="mx-auto max-w-xl px-6 py-14">
          <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={34} />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Ombi Lako Limepokelewa!</h1>
            <p className="mt-2 text-sm text-slate-500">
              Asante, <span className="font-semibold text-slate-700">{form.ownerName.split(" ")[0]}</span>. Timu ya Sipiki itakagua
              maombi ya <span className="font-semibold text-slate-700">{form.businessName}</span> na kukupa jibu.
            </p>

            <div className="mx-auto mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Namba ya Ombi</p>
              <p className="font-mono text-lg font-bold text-amber-300">{submitted}</p>
            </div>

            <ol className="mt-8 space-y-4 text-left">
              {[
                { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100", title: "Ombi limetumwa", text: "Taarifa na nyaraka zako zimepokelewa." },
                { icon: Clock, color: "text-orange-600 bg-orange-100", title: "Ukaguzi unaendelea", text: "Tunahakiki nyaraka zako (siku 2–3 za kazi)." },
                { icon: Store, color: "text-slate-500 bg-slate-100", title: "Anza kuuza", text: "Ukiidhinishwa, utapata ujumbe wa SMS na barua pepe." },
              ].map(({ icon: Icon, color, title, text }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${color}`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{title}</p>
                    <p className="text-xs text-slate-500">{text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <Link
              href="/"
              className="mt-8 block w-full rounded-xl bg-orange-600 py-3 text-center text-sm font-bold text-white transition hover:bg-orange-700"
            >
              Rudi Nyumbani
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ---------------- Wizard ----------------
  return (
    <div className="min-h-screen bg-orange-50/40" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <Header />

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-5">
        {/* Benefits panel */}
        <aside className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-700 p-8 text-white lg:col-span-2">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-widest">BIASHARA MKONONI</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight">Uza Bidhaa Zako Kote Tanzania</h1>
          <p className="mt-3 text-sm text-white/80">Fungua duka lako kwenye Sipiki kwa dakika chache na ufikie maelfu ya wateja.</p>

          <ul className="mt-8 space-y-5">
            {[
              { icon: TrendingUp, title: "Wateja wengi zaidi", text: "Bidhaa zako zinaonekana nchi nzima, si mtaani tu." },
              { icon: Wallet, title: "Malipo kwa Mobile Money", text: "Pokea mauzo yako moja kwa moja kwenye simu yako." },
              { icon: Truck, title: "Maagizo yamepangwa", text: "Dashibodi ya kufuatilia maagizo na mauzo yako." },
              { icon: BadgePercent, title: "Hakuna ada ya kujiunga", text: "Unalipa kamisheni pale tu unapouza." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon size={19} />
                </span>
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="text-xs text-white/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Form card */}
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-3">
          <Stepper current={step} />

          {/* ---- Step 1: Business ---- */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-xl font-extrabold text-slate-900">Taarifa za Biashara</h2>

              <Field label="Jina la Biashara / Duka" error={errors.businessName}>
                <input className={inputCls(errors.businessName)} value={form.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="mf. Amina Fashion" />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Aina ya Biashara" error={errors.businessType}>
                  <select className={inputCls(errors.businessType)} value={form.businessType} onChange={(e) => set("businessType", e.target.value)}>
                    <option value="">Chagua...</option>
                    {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Mkoa" error={errors.region}>
                  <select className={inputCls(errors.region)} value={form.region} onChange={(e) => set("region", e.target.value)}>
                    <option value="">Chagua...</option>
                    {REGIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Eneo la Duka" error={errors.location} hint="Wilaya, soko au mtaa ulipo duka lako">
                <input className={inputCls(errors.location)} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="mf. Kariakoo, Mtaa wa Sikukuu" />
              </Field>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Unauza Bidhaa Gani?</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const on = form.categories.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          on ? "border-orange-500 bg-orange-500 text-white" : "border-stone-300 bg-white text-slate-600 hover:border-orange-400"
                        }`}
                      >
                        {on && <Check size={13} className="mr-1 inline" />}
                        {cat}
                      </button>
                    );
                  })}
                </div>
                {errors.categories && <p className="mt-1 text-xs font-medium text-red-600">{errors.categories}</p>}
              </div>

              <Field label="Maelezo Mafupi (hiari)" hint="Eleza biashara yako kwa wateja">
                <textarea rows={3} className={inputCls(false)} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Tunauza mavazi ya kitenge na ankara..." />
              </Field>
            </div>
          )}

          {/* ---- Step 2: Owner ---- */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-extrabold text-slate-900">Taarifa za Mmiliki</h2>

              <Field label="Majina Kamili" error={errors.ownerName}>
                <input className={inputCls(errors.ownerName)} value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="mf. Amina Juma Mrisho" />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Namba ya Simu" error={errors.phone}>
                  <div className="flex">
                    <span className="flex items-center rounded-l-xl border border-r-0 border-stone-300 bg-stone-50 px-3 text-sm text-slate-500">+255</span>
                    <input className={`${inputCls(errors.phone)} rounded-l-none`} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="712 345 678" inputMode="tel" />
                  </div>
                </Field>
                <Field label="Barua Pepe" error={errors.email}>
                  <input type="email" className={inputCls(errors.email)} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="amina@example.com" />
                </Field>
              </div>

              <Field label="Namba ya NIDA" error={errors.nida} hint="Tarakimu 20">
                <input className={inputCls(errors.nida)} value={form.nida} onChange={(e) => set("nida", e.target.value.replace(/\D/g, "").slice(0, 20))} placeholder="00000000000000000000" inputMode="numeric" />
              </Field>

              <Field label="Namba ya TIN" error={errors.tin} hint="Tarakimu 9 (mf. 123-456-789)">
                <input className={inputCls(errors.tin)} value={form.tin} onChange={(e) => set("tin", formatTin(e.target.value))} placeholder="123-456-789" inputMode="numeric" />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nenosiri" error={errors.password} hint="Angalau herufi 8 — utalitumia kuingia">
                  <input type="password" autoComplete="new-password" className={inputCls(errors.password)} value={form.password} onChange={(e) => set("password", e.target.value)} />
                </Field>
                <Field label="Rudia Nenosiri" error={errors.confirmPassword}>
                  <input type="password" autoComplete="new-password" className={inputCls(errors.confirmPassword)} value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {/* ---- Step 3: Payout ---- */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Akaunti ya Malipo</h2>
                <p className="mt-1 text-sm text-slate-500">Mauzo yako yatalipwa kwenye namba hii ya Mobile Money.</p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Mtandao</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PAYOUT_PROVIDERS.map((p) => {
                    const on = form.payoutProvider === p;
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => set("payoutProvider", p)}
                        className={`rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${
                          on ? "border-orange-500 bg-orange-50 text-orange-700" : "border-stone-200 text-slate-600 hover:border-orange-300"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                {errors.payoutProvider && <p className="mt-1 text-xs font-medium text-red-600">{errors.payoutProvider}</p>}
              </div>

              <Field label="Namba ya Simu ya Malipo" error={errors.payoutPhone}>
                <div className="flex">
                  <span className="flex items-center rounded-l-xl border border-r-0 border-stone-300 bg-stone-50 px-3 text-sm text-slate-500">+255</span>
                  <input className={`${inputCls(errors.payoutPhone)} rounded-l-none`} value={form.payoutPhone} onChange={(e) => set("payoutPhone", e.target.value)} placeholder="712 345 678" inputMode="tel" />
                </div>
              </Field>

              <Field label="Jina la Mmiliki wa Namba" error={errors.payoutName} hint="Lazima lifanane na jina lililosajiliwa kwenye namba">
                <input className={inputCls(errors.payoutName)} value={form.payoutName} onChange={(e) => set("payoutName", e.target.value)} placeholder="mf. Amina Juma Mrisho" />
              </Field>
            </div>
          )}

          {/* ---- Step 4: Documents ---- */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Nyaraka za Uthibitisho</h2>
                <p className="mt-1 text-sm text-slate-500">Zinatumika kuhakiki biashara yako tu — hazionekani kwa wateja.</p>
              </div>

              {DOCS.map((d) => (
                <FileInput key={d.key} label={d.label} hint={d.hint} file={form[d.key]} error={errors[d.key]} onChange={(file) => set(d.key, file)} />
              ))}

              <div className={`rounded-xl border p-4 ${errors.terms ? "border-red-400 bg-red-50/50" : "border-stone-200 bg-stone-50"}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} className="mt-1 h-4 w-4 accent-orange-600" />
                  <span className="text-sm text-slate-600">
                    Nimesoma na nakubali <a href="#" className="font-semibold text-orange-600 underline">Masharti ya Wauzaji</a> na{" "}
                    <a href="#" className="font-semibold text-orange-600 underline">Sera ya Faragha</a>, ikiwemo kamisheni ya 10% kwa kila mauzo.
                  </span>
                </label>
                {errors.terms && <p className="mt-2 text-xs font-medium text-red-600">{errors.terms}</p>}
              </div>

              <p className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500" /> Taarifa zako zinahifadhiwa kwa usalama.
              </p>
            </div>
          )}

          {submitError && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{submitError}</div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-5">
            <button
              onClick={back}
              disabled={step === 0}
              className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-stone-100 disabled:invisible"
            >
              <ChevronLeft size={16} /> Rudi
            </button>
            <button
              onClick={next}
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
            >
              {step === STEPS.length - 1 ? (submitting ? "Inatuma..." : "Tuma Ombi") : "Endelea"} <ChevronRight size={16} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b-2 border-orange-500 bg-slate-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-2xl font-extrabold text-transparent">Sipiki</span>
          <span className="hidden text-[11px] font-medium tracking-widest text-slate-400 sm:inline">BIASHARA MKONONI</span>
        </Link>
        <p className="text-sm text-slate-300">
          Una akaunti? <a href="#" className="font-bold text-amber-300 hover:underline">Ingia</a>
        </p>
      </div>
    </header>
  );
}
