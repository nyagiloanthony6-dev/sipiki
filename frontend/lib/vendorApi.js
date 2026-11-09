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

// The owner can run several shops; the chosen shop is sent with every portal request (server checks it is theirs).
const SHOP_KEY = "sipiki_vendor_shop";
export function getShopId() {
  try { return sessionStorage.getItem(SHOP_KEY); } catch { return null; }
}
export function setShopId(id) {
  try {
    if (id) sessionStorage.setItem(SHOP_KEY, id);
    else sessionStorage.removeItem(SHOP_KEY);
  } catch { /* choice is forgotten on reload — the first approved shop is used */ }
}
const shopHeader = () => (getShopId() ? { "X-Shop-Id": getShopId() } : {});

/** Same as request(), but signed with the vendor's token and aimed at the chosen shop. */
export const vrequest = (path, options = {}) =>
  request(path, { ...options, token: getVendorToken(), headers: { ...shopHeader(), ...(options.headers || {}) } });

/** Adds another shop (multipart: text fields + licenseDoc + tinDoc). Returns the created shop. */
export async function createShop(formData) {
  let res;
  try {
    res = await fetch(`${API_URL}/vendors/me/shops`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getVendorToken()}`, ...shopHeader() },
      body: formData,
    });
  } catch {
    throw new ApiError("Imeshindikana kuwasiliana na seva.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Imeshindikana kutuma ombi la duka", res.status, data);
  return data.shop;
}

/** Photos are stored as relative addresses (/api/media/...) — put the API address in front. */
export function imageSrc(url, width) {
  if (!url) return null;
  const full = /^https?:\/\//.test(url) ? url : `${API_URL.replace(/\/api$/, "")}${url}`;
  // width 400 or 800 asks the server for a smaller copy (much faster on mobile data)
  return width ? `${full}?w=${width}` : full;
}

/**
 * Looks at a picked photo and returns plain-language warnings (Swahili): too small, or too dark.
 * Never blocks the upload — the vendor decides. Returns [] if the browser cannot read the file.
 */
export async function checkPhoto(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const warnings = [];
    if (Math.min(bitmap.width, bitmap.height) < 600) warnings.push("Picha ni ndogo mno — itaonekana ukungu. Piga picha karibu zaidi au tumia kamera ya nyuma.");
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, size, size);
    bitmap.close?.();
    const { data } = ctx.getImageData(0, 0, size, size);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const avg = sum / (data.length / 4);
    if (avg < 70) warnings.push("Picha ni giza. Piga karibu na dirisha au nje kwenye mwanga wa mchana.");
    else if (avg > 252) warnings.push("Picha inaonekana nyeupe karibu yote. Epuka mwanga mkali moja kwa moja kwenye bidhaa.");
    return warnings;
  } catch {
    return [];
  }
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
      headers: { Authorization: `Bearer ${getVendorToken()}`, ...shopHeader() },
      body,
    });
  } catch {
    throw new ApiError("Imeshindikana kuwasiliana na seva.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Imeshindikana kupakia picha", res.status);
  return data.image;
}
