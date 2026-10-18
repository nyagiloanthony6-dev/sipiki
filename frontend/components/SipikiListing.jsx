"use client";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { Search, ChevronDown, Heart, Plus, Minus, X, ShoppingCart, Home, Package, LayoutDashboard, ShieldCheck, Star, ChevronLeft, ChevronRight, ArrowRight, MapPin, Phone, Mail, Truck, ShieldCheck as Shield, Headphones, RotateCcw } from "lucide-react";

// ============================================================================
// MOCK CATALOG — general Tanzanian marketplace listing (Jumia/Kilimall-style)
// Mirrors the GET /api/products response shape from the backend scaffold
// ============================================================================
const CATEGORIES = ["Makundi Yote", "Mavazi", "Simu na Vifaa", "Viatu", "Urembo", "Mikoba na Vifaa"];

const PRODUCTS = [
  { id: "p1", title: "Dress ya Kitenge Ankara", vendor: "Amina Fashion", category: "Mavazi", emoji: "👗", tile: "bg-sky-100", rating: 4.9, reviews: 128, oldPrice: 50000, price: 35000, badge: null },
  { id: "p2", title: "Samsung Galaxy A15 128GB", vendor: "Tech Hub Kariakoo", category: "Simu na Vifaa", emoji: "📱", tile: "bg-amber-100", rating: 4.8, reviews: 86, oldPrice: null, price: 450000, badge: null },
  { id: "p3", title: "Nike Air Force Replica", vendor: "Juma Shoes", category: "Viatu", emoji: "👟", tile: "bg-rose-100", rating: 4.7, reviews: 64, oldPrice: 70000, price: 55000, badge: null },
  { id: "p4", title: "Beauty Makeup Kit Set", vendor: "Zawadi Beauty", category: "Urembo", emoji: "💄", tile: "bg-pink-100", rating: 4.9, reviews: 201, oldPrice: 35000, price: 28000, badge: null },
  { id: "p5", title: "Kanga la Tanzania 2pcs", vendor: "Mama Fatuma Store", category: "Mavazi", emoji: "🎀", tile: "bg-purple-100", rating: 4.6, reviews: 45, oldPrice: null, price: 18000, badge: { label: "NEW", cls: "bg-blue-600" } },
  { id: "p6", title: "Bluetooth Speaker JBL", vendor: "Tech Hub Kariakoo", category: "Simu na Vifaa", emoji: "🔊", tile: "bg-cyan-100", rating: 4.8, reviews: 93, oldPrice: 120000, price: 85000, badge: { label: "SALE", cls: "bg-red-600" } },
  { id: "p7", title: "Mfuko wa Ngozi Handmade", vendor: "Kariakoo Leather", category: "Mikoba na Vifaa", emoji: "👜", tile: "bg-yellow-100", rating: 4.9, reviews: 77, oldPrice: null, price: 42000, badge: null },
  { id: "p8", title: "Itel A70 64GB", vendor: "Tech Hub Kariakoo", category: "Simu na Vifaa", emoji: "📲", tile: "bg-indigo-100", rating: 4.5, reviews: 34, oldPrice: 220000, price: 195000, badge: { label: "DEAL", cls: "bg-orange-600" } },
];

// ============================================================================
// HERO SLIDES — promo banners shown at the top of the listing page
// `category` makes the CTA jump the grid to that category
// ============================================================================
const SLIDES = [
  { id: "s1", tag: "PUNGUZO LA WIKI", title: "Simu Mpya, Bei Poa", text: "Samsung, Itel na zaidi kutoka Tech Hub Kariakoo — punguzo hadi TSh 25,000.", cta: "Nunua Simu", category: "Simu na Vifaa", emoji: "📱", grad: "from-slate-900 via-slate-800 to-orange-700" },
  { id: "s2", tag: "MAVAZI MAPYA", title: "Kitenge & Ankara za Kisasa", text: "Mitindo mipya kutoka kwa wauzaji wa Kariakoo, imetengenezwa Tanzania.", cta: "Tazama Mavazi", category: "Mavazi", emoji: "👗", grad: "from-purple-800 via-fuchsia-700 to-orange-500" },
  { id: "s3", tag: "UREMBO", title: "Jipendeze Kila Siku", text: "Makeup kits na bidhaa za urembo kutoka Zawadi Beauty — bei nafuu.", cta: "Nunua Urembo", category: "Urembo", emoji: "💄", grad: "from-rose-700 via-pink-600 to-amber-400" },
  { id: "s4", tag: "BIASHARA MKONONI", title: "Uza Kwenye Sipiki", text: "Fungua duka lako bure na ufikie wateja kote Tanzania. Malipo kwa M-Pesa, Tigo Pesa na Airtel Money.", cta: "Jiandikishe Kama Muuzaji", category: null, href: "/register", emoji: "🏪", grad: "from-emerald-800 via-teal-700 to-sky-600" },
];

function HeroSlider({ onSelectCategory }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance every 5s; pauses while the user hovers the banner
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  const go = (dir) => setIndex((i) => (i + dir + SLIDES.length) % SLIDES.length);

  return (
    <section
      className="relative mx-auto mt-6 max-w-7xl overflow-hidden rounded-2xl px-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((slide) => (
            <div
              key={slide.id}
              className={`relative flex min-w-full items-center justify-between gap-6 bg-gradient-to-r ${slide.grad} px-8 py-10 text-white sm:px-14 sm:py-14`}
            >
              <div className="max-w-xl">
                <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-widest">
                  {slide.tag}
                </span>
                <h2 className="mt-3 text-3xl font-extrabold leading-tight sm:text-5xl">{slide.title}</h2>
                <p className="mt-3 max-w-md text-sm text-white/85 sm:text-base">{slide.text}</p>
                {slide.href ? (
                  <Link
                    href={slide.href}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300"
                  >
                    {slide.cta}
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <button
                    onClick={() => slide.category && onSelectCategory(slide.category)}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300"
                  >
                    {slide.cta}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
              <span className="hidden select-none text-[9rem] leading-none drop-shadow-lg sm:block">{slide.emoji}</span>
            </div>
          ))}
        </div>

        {/* Arrows */}
        <button
          onClick={() => go(-1)}
          className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white"
          aria-label="Slaidi iliyopita"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => go(1)}
          className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white"
          aria-label="Slaidi inayofuata"
        >
          <ChevronRight size={18} />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setIndex(i)}
              aria-label={`Nenda slaidi ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-amber-400" : "w-2 bg-white/60"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// MARQUEE TICKER — scrolling announcement strip between the slides and the grid
// The list is rendered twice so the -50% translate loops seamlessly
// ============================================================================
const TICKER_ITEMS = [
  "🚚 Usafirishaji kote Tanzania",
  "📱 Lipa kwa M-Pesa, Tigo Pesa & Airtel Money",
  "✅ Wauzaji waliothibitishwa",
  "🔥 Punguzo kila siku",
  "🏪 Fungua duka lako bure",
  "🇹🇿 Biashara ya Kitanzania, Mkononi Mwako",
];

function Ticker() {
  const loop = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="mt-6 overflow-hidden border-y-2 border-orange-500 bg-slate-900 py-2.5">
      <style>{`
        @keyframes sipiki-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .sipiki-marquee { animation: sipiki-marquee 30s linear infinite; }
        .sipiki-marquee:hover { animation-play-state: paused; }
      `}</style>
      <div className="sipiki-marquee flex w-max items-center whitespace-nowrap">
        {loop.map((text, i) => (
          <span key={i} className="flex items-center text-sm font-semibold text-amber-300">
            <span className="px-6">{text}</span>
            <span className="text-orange-500">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SHOP BY CATEGORY — visual tiles, kept in sync with the dropdown filter
// ============================================================================
const CATEGORY_META = {
  "Makundi Yote": { emoji: "🛍️", tile: "bg-orange-100", ring: "ring-orange-400" },
  "Mavazi": { emoji: "👗", tile: "bg-sky-100", ring: "ring-sky-400" },
  "Simu na Vifaa": { emoji: "📱", tile: "bg-amber-100", ring: "ring-amber-400" },
  "Viatu": { emoji: "👟", tile: "bg-rose-100", ring: "ring-rose-400" },
  "Urembo": { emoji: "💄", tile: "bg-pink-100", ring: "ring-pink-400" },
  "Mikoba na Vifaa": { emoji: "👜", tile: "bg-yellow-100", ring: "ring-yellow-500" },
};

function CategorySection({ active, onSelect }) {
  // Product count per category, derived from the catalog
  const countFor = (cat) =>
    cat === "Makundi Yote" ? PRODUCTS.length : PRODUCTS.filter((p) => p.category === cat).length;

  return (
    <section className="mx-auto max-w-7xl px-6 pt-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Makundi ya Bidhaa</h2>
          <p className="text-xs text-slate-500">Chagua kundi ili kuona bidhaa zake</p>
        </div>
        {active !== "Makundi Yote" && (
          <button onClick={() => onSelect("Makundi Yote")} className="text-sm font-semibold text-orange-600 hover:underline">
            Ondoa kichujio ✕
          </button>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-6 sm:overflow-visible">
        {CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const isActive = active === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={`group flex min-w-[110px] flex-1 flex-col items-center rounded-2xl border bg-white p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md sm:min-w-0 ${
                isActive ? `border-transparent ring-2 ${meta.ring} shadow-md` : "border-stone-200"
              }`}
            >
              <span className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl transition group-hover:scale-110 ${meta.tile}`}>
                {meta.emoji}
              </span>
              <span className={`mt-2 text-sm font-bold leading-tight ${isActive ? "text-orange-600" : "text-slate-800"}`}>{cat}</span>
              <span className="mt-0.5 text-[11px] text-slate-400">Bidhaa {countFor(cat)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER — trust strip, about, links, categories, contact, payments
// ============================================================================
const PAYMENT_METHODS = ["M-Pesa", "Tigo Pesa", "Airtel Money", "HaloPesa", "Visa", "Mastercard"];

function Footer({ onSelectCategory }) {
  const pickCategory = (cat) => {
    onSelectCategory(cat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const trust = [
    { icon: Truck, title: "Usafirishaji Nchi Nzima", text: "Tunafikisha kila mkoa" },
    { icon: Shield, title: "Malipo Salama", text: "M-Pesa, Tigo Pesa, Airtel & kadi" },
    { icon: RotateCcw, title: "Rudisha Bidhaa", text: "Ndani ya siku 7" },
    { icon: Headphones, title: "Msaada wa Wateja", text: "Jumatatu – Jumamosi" },
  ];

  const linkCls = "text-sm text-slate-400 transition hover:text-amber-300";

  return (
    <footer className="mt-12 bg-slate-900 text-slate-300">
      {/* Trust strip */}
      <div className="border-b border-slate-800">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-6 py-6 lg:grid-cols-4">
          {trust.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-orange-600/15 text-orange-400">
                <Icon size={20} />
              </span>
              <div>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="text-xs text-slate-400">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main columns */}
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-baseline gap-3">
            <span className="bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-3xl font-extrabold text-transparent">
              Sipiki
            </span>
            <span className="text-[11px] font-medium tracking-widest text-slate-500">BIASHARA MKONONI</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
            Sipiki ni soko la mtandaoni linalowaunganisha wauzaji wa Kitanzania na wateja kote nchini —
            kuanzia Kariakoo hadi Zanzibar. Nunua kwa uhakika, uza kwa urahisi.
          </p>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Jiunge na habari za punguzo</p>
          <form onSubmit={(e) => e.preventDefault()} className="mt-2 flex max-w-sm gap-2">
            <input
              type="email"
              placeholder="Barua pepe yako"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-500"
            />
            <button className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500">
              Jiunge
            </button>
          </form>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Makundi</h4>
          <ul className="space-y-2">
            {CATEGORIES.filter((c) => c !== "Makundi Yote").map((cat) => (
              <li key={cat}>
                <button onClick={() => pickCategory(cat)} className={linkCls}>
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Msaada</h4>
          <ul className="space-y-2">
            {["Jinsi ya Kuagiza", "Usafirishaji", "Malipo", "Kurudisha Bidhaa", "Maswali Yanayoulizwa"].map((l) => (
              <li key={l}>
                <a href="#" className={linkCls}>
                  {l}
                </a>
              </li>
            ))}
          </ul>
          <h4 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wider text-white">Wauzaji</h4>
          <ul className="space-y-2">
            {[["Fungua Duka Lako", "/register"], ["Dashibodi ya Muuzaji", "#"], ["Sheria za Wauzaji", "#"]].map(([l, href]) => (
              <li key={l}>
                <Link href={href} className={linkCls}>
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Wasiliana Nasi</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <MapPin size={16} className="mt-0.5 flex-shrink-0 text-orange-400" />
              Dar es Salaam, Tanzania
            </li>
            <li className="flex items-start gap-2">
              <Phone size={16} className="mt-0.5 flex-shrink-0 text-orange-400" />
              +255 7XX XXX XXX
            </li>
            <li className="flex items-start gap-2">
              <Mail size={16} className="mt-0.5 flex-shrink-0 text-orange-400" />
              msaada@sipiki.co.tz
            </li>
          </ul>

          <div className="mt-5 flex gap-2">
            {["Instagram", "Facebook", "WhatsApp", "TikTok"].map((name) => (
              <a
                key={name}
                href="#"
                aria-label={name}
                title={name}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-[11px] font-bold text-slate-300 transition hover:border-orange-500 hover:text-orange-400"
              >
                {name.slice(0, 2)}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Payments + legal */}
      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-5 text-xs text-slate-500 lg:flex-row">
          <p>© 2026 Sipiki. Haki zote zimehifadhiwa.</p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1 text-slate-500">Tunakubali:</span>
            {PAYMENT_METHODS.map((m) => (
              <span key={m} className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {m}
              </span>
            ))}
          </div>

          <div className="flex gap-4">
            <a href="#" className="hover:text-amber-300">Masharti ya Matumizi</a>
            <a href="#" className="hover:text-amber-300">Sera ya Faragha</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function formatPrice(v) {
  return `TSh ${v.toLocaleString("en-US")}`;
}

function StarRating({ rating, reviews }) {
  return (
    <div className="mt-1 flex items-center gap-1 text-xs">
      <div className="flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            size={13}
            className={i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
          />
        ))}
      </div>
      <span className="font-medium text-slate-700">{rating}</span>
      <span className="text-slate-400">({reviews})</span>
    </div>
  );
}

function NavPill({ icon: Icon, emoji, label, className, href }) {
  const cls = `flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${className}`;
  const content = (
    <>
      {emoji ? <span>{emoji}</span> : Icon ? <Icon size={15} /> : null}
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>{content}</Link>
  ) : (
    <button className={cls}>{content}</button>
  );
}

export default function SipikiListing() {
  const [category, setCategory] = useState("Makundi Yote");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]); // { productId, quantity }
  const [wishlist, setWishlist] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => {
      const matchesCategory = category === "Makundi Yote" || p.category === category;
      const matchesSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.vendor.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  // ---- Cart logic — mirrors backend cart.controller.js: addItem increments
  // an existing line, updateItemQuantity <=0 removes it ------------------
  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { productId: product.id, quantity: 1 }];
    });
  }

  function updateQuantity(productId, quantity) {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  }

  function toggleWishlist(productId) {
    setWishlist((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  }

  const cartLines = cart
    .map((line) => ({ ...line, product: PRODUCTS.find((p) => p.id === line.productId) }))
    .filter((line) => line.product);
  const itemCount = cartLines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cartLines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  return (
    <div className="min-h-screen bg-orange-50/40" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* ---------------- Header ---------------- */}
      <header className="border-b-2 border-orange-500 bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <span className="bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-2xl font-extrabold text-transparent">
              Sipiki
            </span>
            <span className="text-[11px] font-medium tracking-widest text-slate-400">BIASHARA MKONONI</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NavPill href="/" emoji="🏠" label="Nyumbani" className="bg-orange-600 text-white hover:bg-orange-500" />
            <NavPill emoji="📦" label="Maagizo" className="bg-purple-600 text-white hover:bg-purple-500" />
            <NavPill icon={LayoutDashboard} label="Dashboard" className="border border-slate-600 text-slate-200 hover:border-slate-400" />
            <NavPill href="/admin" icon={ShieldCheck} label="Admin" className="bg-sky-700 text-white hover:bg-sky-600" />
            <button
              onClick={() => setCartOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-400"
            >
              <ShoppingCart size={15} />
              {itemCount}
            </button>
            <NavPill label="Ingia" className="border border-amber-400 text-amber-300 hover:bg-amber-400/10" />
            <NavPill label="Jiandikishe" className="bg-amber-400 text-slate-900 hover:bg-amber-300" />
          </div>
        </div>
      </header>

      {/* ---------------- Search bar ---------------- */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5">
            <Search size={18} className="text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tafuta bidhaa, duka, au brand..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-stone-400"
            />
          </div>

          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-full w-full appearance-none rounded-xl border border-stone-300 bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-slate-700 sm:w-48"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
          </div>

          <button className="rounded-xl bg-orange-600 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700">
            Tafuta
          </button>
        </div>
      </div>

      {/* ---------------- Hero slides ---------------- */}
      <HeroSlider onSelectCategory={setCategory} />

      {/* ---------------- Moving words ---------------- */}
      <Ticker />

      {/* ---------------- Product categories ---------------- */}
      <CategorySection active={category} onSelect={setCategory} />

      {/* ---------------- Product grid ---------------- */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="mb-4 text-sm text-slate-500">{filtered.length} bidhaa zilizopatikana</p>

        <div className="grid grid-cols-4 gap-3 sm:gap-5">
          {filtered.map((product) => {
            const inCart = cart.find((i) => i.productId === product.id);
            const isWished = wishlist.includes(product.id);

            return (
              <div
                key={product.id}
                className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className={`relative flex aspect-square items-center justify-center ${product.tile}`}>
                  {product.badge && (
                    <span
                      className={`absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${product.badge.cls}`}
                    >
                      {product.badge.label}
                    </span>
                  )}
                  <button
                    onClick={() => toggleWishlist(product.id)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow"
                  >
                    <Heart size={14} className={isWished ? "fill-red-500 text-red-500" : "text-slate-400"} />
                  </button>
                  <span className="text-6xl">{product.emoji}</span>
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    {product.vendor}
                  </p>
                  <h3 className="mt-1 text-sm font-bold leading-snug text-slate-900">{product.title}</h3>
                  <StarRating rating={product.rating} reviews={product.reviews} />

                  <div className="mt-2 flex flex-1 items-end justify-between">
                    <div>
                      {product.oldPrice && (
                        <p className="text-xs text-slate-400 line-through">{formatPrice(product.oldPrice)}</p>
                      )}
                      <p className="text-base font-bold text-orange-600">
                        <span className="text-xs font-semibold">TSh </span>
                        {product.price.toLocaleString("en-US")}
                      </p>
                    </div>

                    <button
                      onClick={() => addToCart(product)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-white transition hover:bg-orange-700"
                      aria-label="Ongeza kwenye kikapu"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {inCart && (
                    <p className="mt-1.5 text-center text-[11px] font-medium text-emerald-700">
                      Kwenye kikapu · {inCart.quantity}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="mt-12 text-center text-sm text-slate-400">Hakuna bidhaa zilizopatikana.</p>
        )}
      </main>

      {/* ---------------- Footer ---------------- */}
      <Footer onSelectCategory={setCategory} />

      {/* ---------------- Cart drawer ---------------- */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setCartOpen(false)} />
          <div className="relative flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Kikapu Chako</h2>
              <button onClick={() => setCartOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartLines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <ShoppingCart size={32} className="mb-2" />
                  <p className="text-sm">Kikapu chako kiko tupu.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartLines.map((line) => (
                    <div key={line.productId} className="flex items-center gap-3 rounded-lg border border-stone-200 p-2.5">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${line.product.tile}`}>
                        <span className="text-2xl">{line.product.emoji}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{line.product.title}</p>
                        <p className="text-xs text-orange-600">{formatPrice(line.product.price)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(line.productId, line.quantity - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-slate-600"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-4 text-center text-sm">{line.quantity}</span>
                        <button
                          onClick={() => updateQuantity(line.productId, line.quantity + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-slate-600"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cartLines.length > 0 && (
              <div className="border-t border-stone-200 px-5 py-4">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Jumla</span>
                  <span className="text-base font-bold text-slate-900">{formatPrice(subtotal)}</span>
                </div>
                <button className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
                  Endelea na Malipo
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
