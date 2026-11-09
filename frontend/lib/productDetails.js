// ============================================================================
// What a seller is asked to fill in for each kind of product. The categories are
// managed by the admin (they can add new ones), so the kind is guessed from the
// category name; anything unknown gets a general set of fields.
// ============================================================================
const CLOTHES = ["S", "M", "L", "XL", "XXL"];
const SHOES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

const PROFILES = [
  { match: /viatu|shoe|sandal|raba/, sizes: SHOES, sizeHint: "Saizi za viatu", specs: ["Chapa", "Kitambaa", "Kwa nani (mwanaume / mwanamke / mtoto)", "Hali (mpya / imetumika)"] },
  { match: /mavazi|nguo|fashion|cloth|kitenge|kanga|suti|dress/, sizes: CLOTHES, sizeHint: "Saizi za nguo", specs: ["Kitambaa", "Kwa nani (mwanaume / mwanamke / mtoto)", "Chapa", "Jinsi ya kufua"] },
  { match: /simu|vifaa vya umeme|electronic|umeme|kompyuta|computer|laptop|tv/, sizes: [], specs: ["Chapa", "Modeli", "Kumbukumbu (Storage)", "RAM", "Betri", "Dhamana", "Hali (mpya / imetumika)"] },
  { match: /urembo|beauty|vipodozi|nywele|perfume|manukato/, sizes: [], specs: ["Chapa", "Ujazo (ml au g)", "Aina ya ngozi / nywele", "Tarehe ya kuisha muda", "Nchi ya utengenezaji"] },
  { match: /mikoba|begi|bag|mkoba|saa|watch|vito|jewel/, sizes: [], specs: ["Ukubwa (urefu x upana)", "Kitambaa", "Chapa", "Hali (mpya / imetumika)"] },
  { match: /spea|magari|gari|auto|part|pikipiki|vipuri|rubber|kemikali/, sizes: [], specs: ["Chapa", "Inafaa gari (mf. Toyota IST)", "Namba ya sehemu", "Nchi ya utengenezaji", "Dhamana"] },
];
const GENERAL = { sizes: [], specs: ["Chapa", "Nyenzo / Kitambaa", "Ukubwa", "Dhamana", "Hali (mpya / imetumika)"] };

export function profileFor(categoryName) {
  const name = String(categoryName || "").toLowerCase();
  return PROFILES.find((p) => p.match.test(name)) || GENERAL;
}

export const COLOR_SUGGESTIONS = ["Nyeusi", "Nyeupe", "Nyekundu", "Bluu", "Kijani", "Kahawia", "Kijivu", "Njano"];
