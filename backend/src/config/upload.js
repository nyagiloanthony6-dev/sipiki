// ============================================================================
// Document upload handling (multer)
//
// Security model for verification documents (IDs, licences):
//  1. Files go to a PRIVATE directory that is never served statically.
//  2. The on-disk name is random and server-generated — the client-supplied
//     filename is stored for display only and never used as a path.
//  3. Size and type are limited, and the real file type is verified from the
//     file's leading bytes (the browser-declared MIME type can be faked).
//  4. Files can only be read back through the admin-authenticated download
//     route, which resolves the path from the database, not from user input.
//
// To move to cloud storage (S3 / Cloudinary), replace `diskStorage` below and
// the read/delete helpers — nothing else in the app touches the filesystem.
// ============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Where files are stored: UPLOAD_DIR if set, else a folder on the Railway Volume, else a local folder (development).
const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR ||
    (process.env.RAILWAY_VOLUME_MOUNT_PATH && path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')) ||
    path.join(__dirname, '../../private-uploads')
);
fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per document
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

// Form field name  →  document_type enum
const FIELD_TO_DOC_TYPE = {
  idDoc: 'owner_id',
  licenseDoc: 'business_license',
  tinDoc: 'tin_certificate',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => cb(null, crypto.randomBytes(24).toString('hex')), // no extension, no user input
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 3, fields: 30 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Aina ya faili hairuhusiwi. Tumia PDF, JPG au PNG.'));
    }
    cb(null, true);
  },
}).fields(Object.keys(FIELD_TO_DOC_TYPE).map((name) => ({ name, maxCount: 1 })));

// Magic numbers: PDF "%PDF", JPEG FF D8 FF, PNG 89 50 4E 47
const SIGNATURES = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
];

/** Returns the real MIME type detected from the file's first bytes, or null if it is not an allowed type. */
function detectMime(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(8);
    fs.readSync(fd, head, 0, 8, 0);
    const match = SIGNATURES.find((sig) => sig.bytes.every((b, i) => head[i] === b));
    return match ? match.mime : null;
  } finally {
    fs.closeSync(fd);
  }
}

function deleteStoredFile(storageKey) {
  // storageKey comes from our own DB / multer (hex only); still guard against traversal
  if (!/^[a-f0-9]{48}$/.test(storageKey)) return;
  fs.promises.unlink(path.join(UPLOAD_DIR, storageKey)).catch(() => {});
}

function storedFilePath(storageKey) {
  if (!/^[a-f0-9]{48}$/.test(storageKey)) throw new Error('Invalid storage key');
  return path.join(UPLOAD_DIR, storageKey);
}

module.exports = { upload, FIELD_TO_DOC_TYPE, detectMime, deleteStoredFile, storedFilePath };
