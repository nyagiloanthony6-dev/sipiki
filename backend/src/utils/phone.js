// ============================================================================
// Tanzanian phone number helpers
// Accepts: 0712345678 · 712345678 · +255712345678 · 255 712 345 678
// Stores/sends as: 255712345678 (the format SMS and Mobile Money APIs expect)
// ============================================================================

/** Returns "255XXXXXXXXX" or null when the input is not a valid Tanzanian mobile number. */
function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (/^255[67]\d{8}$/.test(digits)) return digits;
  if (/^0[67]\d{8}$/.test(digits)) return `255${digits.slice(1)}`;
  if (/^[67]\d{8}$/.test(digits)) return `255${digits}`;
  return null;
}

module.exports = { normalizePhone };
