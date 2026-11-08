// ============================================================================
// Small API client for the admin dashboard.
//  - The sign-in token is kept in sessionStorage: it disappears when the tab is
//    closed (admin tokens only last 2 hours anyway) and is never sent anywhere
//    except to the Sipiki API.
// ============================================================================
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
export const apiConfigured = Boolean(API_URL);

const TOKEN_KEY = "sipiki_admin_token";

export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked — the user just has to sign in again after a reload */ }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function request(path, { method = "GET", body, token = getToken() } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Imeshindikana kuwasiliana na seva. Angalia mtandao wako kisha jaribu tena.", 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) throw new ApiError(data?.error || "Hitilafu imetokea. Jaribu tena.", res.status, data);
  return data;
}

// Documents are private: the browser must send the token, so we download the file
// as a blob and show it from a temporary local address.
export async function fetchDocumentBlob(vendorId, docId) {
  let res;
  try {
    res = await fetch(`${API_URL}/admin/vendors/${vendorId}/documents/${docId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Imeshindikana kuwasiliana na seva.", 0);
  }
  if (!res.ok) {
    let msg = "Imeshindikana kufungua nyaraka";
    try { msg = (await res.json()).error || msg; } catch { /* keep default */ }
    throw new ApiError(msg, res.status);
  }
  return res.blob();
}
