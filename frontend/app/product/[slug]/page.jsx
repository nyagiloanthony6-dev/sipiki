import SipikiProduct from "../../../components/SipikiProduct";

const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

// The title and first photo are put in the page head so a link shared on WhatsApp shows a preview card.
export async function generateMetadata({ params }) {
  const fallback = { title: "Bidhaa — Sipiki" };
  if (!API) return fallback;
  try {
    const res = await fetch(`${API}/products/${encodeURIComponent(params.slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return fallback;
    const p = await res.json();
    const first = p.images?.[0]?.url;
    const image = first ? (/^https?:\/\//.test(first) ? first : `${API.replace(/\/api$/, "")}${first}`) + "?w=800" : null;
    const price = `TSh ${Math.round(p.priceCents / 100).toLocaleString("en-US")}`;
    const description = `${price} — ${p.vendor?.storeName || "Sipiki"}${p.description ? `. ${p.description.slice(0, 120)}` : ""}`;
    return {
      title: `${p.title} — Sipiki`,
      description,
      openGraph: { title: p.title, description, ...(image ? { images: [image] } : {}) },
    };
  } catch {
    return fallback;
  }
}

export default function Page({ params }) {
  return <SipikiProduct slug={params.slug} />;
}
