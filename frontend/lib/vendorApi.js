// ============================================================================
// API helpers for the vendor portal (and for showing product photos).
// Uses its own sign-in token so a vendor session and an admin session in the
// same browser never mix. The token lives in sessionStorage (gone when the tab closes).
// ============================================================================
import { API_URL, ApiError, request } from "./adminApi";

const TOKEN_KEY = "sipiki_vendor_token";

export function getVendorToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setVendorToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked — the vendor signs in again after a reload */ }
}

/** Same as request(), but signed with the vendor's token. */
export const vrequest = (path, options = {}) => request(path, { ...options, token: getVendorToken() });

/** Photos are stored as relative addresses (/api/media/...) — put the API address in front. */
export function imageSrc(url) {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${API_URL.replace(/\/api$/, "")}${url}`;
}

/**
 * Shrinks a phone photo before upload: longest side 1280 px, JPEG. A 6 MB camera photo becomes
 * about 200 KB, which uploads quickly on mobile data and loads fast in the shop.
 * Falls back to the original file if the browser cannot decode it.
 */
export async function shrinkImage(file, maxSide = 1280, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // PNGs with transparency would otherwise turn black
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadProductImage(productId, fileOrBlob) {
  const body = new FormData();
  body.append("image", fileOrBlob, "photo.jpg");
  let res;
  try {
    res = await fetch(`${API_URL}/vendors/me/products/${productId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getVendorToken()}` },
      body,
    });
  } catch {
    throw new ApiError("Imeshindikana kuwasiliana na seva.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Imeshindikana kupakia picha", res.status);
  return data.image;
}
