// ============================================================================
// Sipiki brand pieces, styled to sit in the same family as serengeti/labs:
// a bold wordmark set in Geist. Sipiki keeps its own warm orange.
// ============================================================================

/** The mark: a bold white S on an orange tile. Reads well as a favicon and as a phone home-screen icon. */
export function LogoMark({ className = "", style }) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#ea580c" />
      <path d="M44 21 C44 11 20 11 20 23 C20 35 44 29 44 41 C44 53 20 53 20 43" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + "SIPIKI" in heavy Geist capitals. `size` is a Tailwind text size class; `dark` is for a dark background.
 *  `tagline` adds the "| BIASHARA MKONONI" divider and strapline. */
export function Wordmark({ size = "text-2xl", dark = false, tagline = false }) {
  return (
    <span className={`${size} inline-flex items-center gap-[0.3em] leading-none ${dark ? "text-white" : "text-slate-900"}`} role="img" aria-label="Sipiki">
      <LogoMark className="flex-none" style={{ height: "1.25em", width: "1.25em" }} />
      <span aria-hidden="true" className="font-black tracking-[0.04em]">SIPIKI</span>
      {tagline && (
        <>
          <span aria-hidden="true" className={`mx-[0.1em] h-[1.1em] w-[2px] rounded ${dark ? "bg-slate-600" : "bg-slate-300"}`} />
          <span aria-hidden="true" className={`text-[0.3em] font-bold leading-[1.35] tracking-[0.2em] ${dark ? "text-slate-400" : "text-slate-500"}`}>BIASHARA<br />MKONONI</span>
        </>
      )}
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
