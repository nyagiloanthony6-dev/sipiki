// ============================================================================
// Sipiki brand pieces, styled to sit in the same family as serengeti/labs:
// a lowercase wordmark with a slash, set in Geist. Sipiki keeps its own warm orange.
// ============================================================================

/** The i-dot: an orange coin sitting where the dot of an "i" would be. */
function I() {
  return (
    <span className="relative inline-block" aria-hidden="true">
      ı<span className="absolute rounded-full bg-orange-500" style={{ left: "50%", top: "0.02em", width: "0.17em", height: "0.17em", transform: "translateX(-50%)" }} />
    </span>
  );
}

/** "sipiki" with the three i-dots in orange — `size` is a Tailwind text size class; `dark` is for a dark background. */
export function Wordmark({ size = "text-2xl", dark = false }) {
  return (
    <span className={`${size} inline-block font-bold leading-none tracking-tight ${dark ? "text-white" : "text-slate-900"}`} role="img" aria-label="Sipiki">
      s<I />p<I />k<I />
    </span>
  );
}

/** "Imetengenezwa na serengeti/labs". Set NEXT_PUBLIC_SERENGETI_URL to make it a link. */
export function MadeBy({ dark = false, className = "" }) {
  const url = process.env.NEXT_PUBLIC_SERENGETI_URL;
  const name = (
    <span className={`font-semibold lowercase tracking-tight ${dark ? "text-slate-300" : "text-slate-700"}`}>
      serengeti<span className="text-orange-500">/</span>labs
    </span>
  );
  return (
    <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"} ${className}`} data-testid="made-by">
      Imetengenezwa na{" "}
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-orange-500">{name}</a> : name}
    </p>
  );
}
