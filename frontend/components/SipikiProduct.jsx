"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X, Store, Tag, ZoomIn, Loader2, PackageX, ShoppingCart, Check } from "lucide-react";
import { API_URL, request } from "../lib/adminApi";
import { imageSrc } from "../lib/vendorApi";
import { useCart } from "../lib/cart";
import { CartDrawer, TrackModal } from "./SipikiCheckout";

// ============================================================================
// SIPIKI — product page: photo gallery (thumbnails, arrows, tap to zoom), price,
// seller and description. Checkout is not open yet, so there is no buy button.
// ============================================================================

function Lightbox({ images, index, setIndex, title, onClose }) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const many = images.length > 1;
  const go = useCallback((d) => { setZoomed(false); setIndex((i) => (i + d + images.length) % images.length); }, [images.length, setIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (many && e.key === "ArrowLeft") go(-1);
      if (many && e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [go, many, onClose]);

  function toggleZoom(e) {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
    setZoomed((z) => !z);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" role="dialog" aria-label="Picha kubwa">
      <button onClick={onClose} aria-label="Funga" className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X size={22} /></button>
      {many && (
        <>
          <button onClick={() => go(-1)} aria-label="Iliyotangulia" className="absolute left-3 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><ChevronLeft size={24} /></button>
          <button onClick={() => go(1)} aria-label="Inayofuata" className="absolute right-3 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><ChevronRight size={24} /></button>
        </>
      )}
      <div className="flex h-full w-full items-center justify-center overflow-hidden p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc(images[index].url)}
          alt={`${title} — picha ${index + 1}`}
          onClick={toggleZoom}
          style={{ transform: zoomed ? "scale(2.2)" : "scale(1)", transformOrigin: origin }}
          className={`max-h-full max-w-full select-none object-contain transition-transform duration-200 ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
          draggable={false}
        />
      </div>
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
        {index + 1} / {images.length} · {zoomed ? "Gusa tena kupunguza" : "Gusa picha kukuza"}
      </p>
    </div>
  );
}

export default function SipikiProduct({ slug }) {
  const [state, setState] = useState(API_URL ? "loading" : "nosite"); // loading | ready | missing | error | nosite
  const [product, setProduct] = useState(null);
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [track, setTrack] = useState(null);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!API_URL) return undefined;
    let cancelled = false;
    setState("loading");
    request(`/products/${encodeURIComponent(slug)}`, { token: null })
      .then((p) => { if (!cancelled) { setProduct(p); setIndex(0); setState("ready"); } })
      .catch((err) => { if (!cancelled) setState(err.status === 404 ? "missing" : "error"); });
    return () => { cancelled = true; };
  }, [slug]);

  const images = product?.images || [];
  const inStock = (product?.stockQuantity ?? 0) > 0;
  const variants = product?.variants || [];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [pickError, setPickError] = useState("");
  // The option the customer has fully chosen (when only sizes or only colours exist, one choice is enough)
  const chosen = variants.length === 0 ? null
    : variants.find((v) => (sizes.length === 0 || v.size === size) && (colors.length === 0 || v.color === color)) || null;
  const left = variants.length === 0 ? product?.stockQuantity ?? 0 : chosen ? chosen.stockQuantity : null;
  // A size/colour is greyed out when nothing is left in it (for the colour/size already picked, if any)
  const available = (kind, value) => variants.some((v) => v[kind] === value && v.stockQuantity > 0 && (kind === "size" ? !color || v.color === color : !size || v.size === size));
  const specs = Array.isArray(product?.specs) ? product.specs : [];

  function addToCart(openCart) {
    if (variants.length > 0 && !chosen) {
      setPickError(sizes.length && !size ? "Chagua saizi kwanza" : "Chagua rangi kwanza");
      return;
    }
    if (chosen && chosen.stockQuantity <= 0) { setPickError("Chaguo hili limeisha. Chagua lingine."); return; }
    setPickError("");
    cart.add({
      id: product.id, title: product.title, price: Math.round(product.priceCents / 100),
      image: images[0] ? imageSrc(images[0].url, 400) : null, vendor: product.vendor?.storeName, slug: product.slug,
      ...(chosen ? { variantId: chosen.id, variantLabel: [chosen.size && `Saizi ${chosen.size}`, chosen.color].filter(Boolean).join(" · "), stock: chosen.stockQuantity } : { stock: product.stockQuantity }),
    });
    if (openCart) setCartOpen(true);
    else { setJustAdded(true); setTimeout(() => setJustAdded(false), 1800); }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-slate-800">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-1.5 text-sm font-bold text-orange-600 hover:text-orange-700"><ArrowLeft size={17} /> Rudi dukani</Link>
          <span className="ml-auto text-lg font-extrabold tracking-tight text-slate-900">SIPIKI</span>
          <button onClick={() => setCartOpen(true)} aria-label="Kikapu" className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-500">
            <ShoppingCart size={15} /> {cart.count}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {state === "loading" && <p className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Inapakia...</p>}
        {state === "nosite" && <p className="py-24 text-center text-sm text-slate-500">Ukurasa huu unahitaji seva ya Sipiki.</p>}
        {(state === "missing" || state === "error") && (
          <div className="py-24 text-center">
            <PackageX size={40} className="mx-auto text-stone-300" />
            <p className="mt-3 font-bold text-slate-800">{state === "missing" ? "Bidhaa hii haipatikani tena" : "Imeshindikana kupakia bidhaa"}</p>
            <p className="mt-1 text-sm text-slate-500">{state === "missing" ? "Huenda imeondolewa na muuzaji." : "Angalia mtandao wako kisha jaribu tena."}</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700">Rudi dukani</Link>
          </div>
        )}

        {state === "ready" && product && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* ---- gallery ---- */}
            <div>
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-white">
                {images.length > 0 ? (
                  <button type="button" onClick={() => setZoomOpen(true)} aria-label="Kuza picha" className="group block h-full w-full cursor-zoom-in">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(images[index].url, 800)} alt={`${product.title} — picha ${index + 1}`} className="h-full w-full object-contain" />
                    <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-white"><ZoomIn size={13} /> Kuza</span>
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-center bg-stone-100 text-sm text-stone-400">Hakuna picha</div>
                )}
                {images.length > 1 && (
                  <>
                    <button onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} aria-label="Iliyotangulia" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"><ChevronLeft size={20} /></button>
                    <button onClick={() => setIndex((i) => (i + 1) % images.length)} aria-label="Inayofuata" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"><ChevronRight size={20} /></button>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {images.map((img, i) => (
                    <button key={img.id} onClick={() => setIndex(i)} aria-label={`Picha ${i + 1}`} className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 ${i === index ? "border-orange-500" : "border-stone-200 hover:border-stone-400"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageSrc(img.url, 400)} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ---- details ---- */}
            <div>
              {product.category?.name && <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Tag size={13} /> {product.category.name}</p>}
              <h1 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900">{product.title}</h1>
              <p className="mt-3 text-3xl font-extrabold text-orange-600"><span className="text-base font-semibold">TSh </span>{Math.round(product.priceCents / 100).toLocaleString("en-US")}</p>
              <p data-testid="stock-pill" className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${inStock && left !== 0 && left !== null ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {!inStock ? "Imeisha" : left === null ? "Chagua saizi / rangi" : left === 0 ? "Imeisha" : `Ipo (${left})`}
              </p>
              {variants.length > 0 && (
                <div className="mt-5 space-y-4" data-testid="options">
                  {sizes.length > 0 && (
                    <fieldset>
                      <legend className="text-sm font-bold text-slate-900">Saizi{size && <span className="ml-2 font-semibold text-slate-500">{size}</span>}</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sizes.map((sz) => {
                          const ok = available("size", sz);
                          return (
                            <button key={sz} type="button" aria-pressed={size === sz} disabled={!ok} onClick={() => { setSize(sz); setPickError(""); }}
                              className={`min-w-[2.75rem] rounded-lg border-2 px-3 py-2 text-sm font-bold transition ${size === sz ? "border-orange-500 bg-orange-50 text-orange-700" : "border-stone-200 text-slate-700 hover:border-stone-400"} ${!ok ? "cursor-not-allowed text-stone-300 line-through hover:border-stone-200" : ""}`}>
                              {sz}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                  {colors.length > 0 && (
                    <fieldset>
                      <legend className="text-sm font-bold text-slate-900">Rangi{color && <span className="ml-2 font-semibold text-slate-500">{color}</span>}</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {colors.map((c) => {
                          const ok = available("color", c);
                          return (
                            <button key={c} type="button" aria-pressed={color === c} disabled={!ok} onClick={() => { setColor(c); setPickError(""); }}
                              className={`rounded-lg border-2 px-3 py-2 text-sm font-bold transition ${color === c ? "border-orange-500 bg-orange-50 text-orange-700" : "border-stone-200 text-slate-700 hover:border-stone-400"} ${!ok ? "cursor-not-allowed text-stone-300 line-through hover:border-stone-200" : ""}`}>
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                  {pickError && <p role="alert" data-testid="pick-error" className="text-sm font-semibold text-red-600">{pickError}</p>}
                </div>
              )}
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><Store size={16} className="text-slate-400" /> Muuzaji: <b className="text-slate-800">{product.vendor?.storeName}</b></p>
              {product.description && (
                <div className="mt-5">
                  <h2 className="text-sm font-bold text-slate-900">Maelezo</h2>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{product.description}</p>
                </div>
              )}
              {specs.length > 0 && (
                <div className="mt-5" data-testid="specs">
                  <h2 className="text-sm font-bold text-slate-900">Maelezo ya bidhaa</h2>
                  <dl className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white text-sm">
                    {specs.map((sp, n) => (
                      <div key={n} className="grid grid-cols-5 gap-2 px-3 py-2">
                        <dt className="col-span-2 font-semibold text-slate-500">{sp.label}</dt>
                        <dd className="col-span-3 break-words text-slate-800">{sp.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button onClick={() => addToCart(true)} disabled={!inStock} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
                  Agiza Sasa
                </button>
                <button onClick={() => addToCart(false)} disabled={!inStock} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-orange-300 py-3 text-sm font-bold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">
                  {justAdded ? <><Check size={16} /> Imewekwa</> : <><ShoppingCart size={16} /> Weka Kikapuni</>}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">Weka namba ya simu na eneo ulipo tu — hakuna akaunti. Unalipa unapopokea bidhaa.</p>
            </div>
          </div>
        )}
      </main>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} onTrack={(init) => setTrack(init || {})} />
      <TrackModal open={Boolean(track)} initial={track} onClose={() => setTrack(null)} />
      {zoomOpen && images.length > 0 && <Lightbox images={images} index={index} setIndex={setIndex} title={product.title} onClose={() => setZoomOpen(false)} />}
    </div>
  );
}
