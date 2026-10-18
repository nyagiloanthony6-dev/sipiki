// ============================================================================
// Field-level encryption (AES-256-GCM) for highly sensitive values such as the
// owner's NIDA number. A database leak alone then does not expose the value —
// the attacker would also need FIELD_ENCRYPTION_KEY from the server environment.
//
// FIELD_ENCRYPTION_KEY must be 32 random bytes, base64-encoded. Generate one:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Rotating the key requires re-encrypting existing rows.
// ============================================================================
const crypto = require('crypto');

function getKey() {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error('FIELD_ENCRYPTION_KEY is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return key;
}

/** Returns "iv.authTag.ciphertext" (all base64) — safe to store in a TEXT column. */
function encryptField(plaintext) {
  const iv = crypto.randomBytes(12); // 96-bit nonce, the recommended size for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString('base64')).join('.');
}

function decryptField(payload) {
  const [iv, tag, ciphertext] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag); // throws on decrypt if the data was tampered with
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Shows only the last 4 characters — what admins see by default (e.g. "****************1234"). */
function maskTail(value, visible = 4) {
  const s = String(value);
  return s.length <= visible ? s : '*'.repeat(s.length - visible) + s.slice(-visible);
}

module.exports = { encryptField, decryptField, maskTail };
