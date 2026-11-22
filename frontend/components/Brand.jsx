// ============================================================================
// Sipiki brand pieces, styled to sit in the same family as serengeti/labs:
// a lowercase wordmark with a slash, set in Geist. Sipiki keeps its own warm orange.
// ============================================================================

/** The price-tag mark: a sign every market understands. Orange; the hole shows whatever is behind it. */
export function TagMark({ className = "", style }) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true" focusable="false">
      <path fillRule="evenodd" fill="#ea580c" d="M10 6 H32 a5 5 0 0 1 3.5 1.5 L57 29 a5 5 0 0 1 0 7 L36 57 a5 5 0 0 1-7 0 L7.5 35.5 A5 5 0 0 1 6 32 V10 a4 4 0 0 1 4-4Z M20 15 a5.5 5.5 0 1 0 0.01 0Z" />
      <path d="M33 35 L41 27 M37 39 L45 31" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

/** Tag mark + "Sipiki" in heavy Geist. `size` is a Tailwind text size class; `dark` is for a dark background. */
export function Wordmark({ size = "text-2xl", dark = false }) {
  return (
    <span className={`${size} inline-flex items-center gap-[0.28em] font-black leading-none tracking-[-0.035em] ${dark ? "text-white" : "text-slate-900"}`} role="img" aria-label="Sipiki">
      <TagMark className="flex-none" style={{ height: "1.15em", width: "1.15em" }} />
      <span aria-hidden="true">Sipiki</span>
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
