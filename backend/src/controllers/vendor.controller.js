// ============================================================================
// Vendor Controller — business registration and the applicant's own status
// ============================================================================
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/db');
const fs = require('fs');
const { upload, FIELD_TO_DOC_TYPE, detectMime, deleteStoredFile, storedFilePath } = require('../config/upload');
const { ownerShops } = require('../utils/shop');
const { vendorRegistrationSchema, newShopSchema } = require('../validators/vendor.validators');
const { encryptField } = require('../utils/crypto');
const { sendSms } = require('../services/sms.service');
const { BCRYPT_ROUNDS } = require('./auth.controller');

// ---- helpers ---------------------------------------------------------------

function slugify(name) {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'duka'}-${crypto.randomBytes(3).toString('hex')}`; // suffix keeps store_slug unique
}

function newApplicationRef() {
  return `SPK-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;
}

// Flatten multer's { idDoc: [file], ... } into a list of files
function uploadedFiles(req) {
  return Object.values(req.files || {}).flat();
}

// multipart/form-data sends everything as strings — restore the real types
function parseMultipartBody(body) {
  let categories = body.categories;
  if (typeof categories === 'string') {
    try {
      categories = JSON.parse(categories);
    } catch {
      categories = [categories];
    }
  }
  return { ...body, categories, terms: body.terms === 'true' || body.terms === true };
}

/** Runs multer and turns its errors into clean 400 responses. */
function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    uploadedFiles(req).forEach((f) => deleteStoredFile(f.filename)); // nothing half-saved
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Faili ni kubwa mno (kiwango ni 5 MB)' : err.message || 'Imeshindikana kupakia faili';
    res.status(400).json({ error: message });
  });
}

// ---- controllers -----------------------------------------------------------

/** GET /api/vendors/categories — the business categories open for registration right now (public) */
async function listCategories(_req, res) {
  try {
    const rows = await prisma.businessCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { name: true },
    });
    res.set('Cache-Control', 'no-store'); // an admin's on/off change must show up immediately
    res.json({ data: rows.map((r) => r.name) });
  } catch (err) {
    console.error('listCategories error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata makundi' });
  }
}

/**
 * POST /api/vendors/register   (multipart/form-data)
 * Public. Creates the owner's user account (role='vendor'), a vendors row with
 * status='pending', stores the three verification documents, and records the
 * first status-history entry — all in one transaction. The vendor cannot list
 * products until an admin approves (see product.controller.createProduct).
 */
async function registerVendor(req, res) {
  const files = uploadedFiles(req);
  const cleanup = () => files.forEach((f) => deleteStoredFile(f.filename));

  try {
    // 1. Validate the text fields
    const parsed = vendorRegistrationSchema.safeParse(parseMultipartBody(req.body));
    if (!parsed.success) {
      cleanup();
      return res.status(400).json({ error: 'Taarifa si sahihi', details: parsed.error.flatten().fieldErrors });
    }
    const d = parsed.data;

    // 1b. Categories must be ones the admin currently has switched on (matched ignoring case)
    const active = await prisma.businessCategory.findMany({ where: { isActive: true }, select: { name: true } });
    const canonical = new Map(active.map((c) => [c.name.toLowerCase(), c.name]));
    const chosen = d.categories.map((c) => canonical.get(c.toLowerCase()));
    if (chosen.some((c) => !c)) {
      cleanup();
      return res.status(400).json({
        error: 'Kundi ulilochagua halipatikani kwa sasa',
        details: { categories: ['Kundi hili halipokei maombi kwa sasa. Chagua kundi jingine.'] },
      });
    }
    d.categories = [...new Set(chosen)];

    // 2. All three documents are required, and each must really be a PDF/JPEG/PNG
    const docRows = [];
    for (const [field, docType] of Object.entries(FIELD_TO_DOC_TYPE)) {
      const file = req.files?.[field]?.[0];
      if (!file) {
        cleanup();
        return res.status(400).json({ error: 'Nyaraka zote tatu zinahitajika', details: { [field]: ['Pakia nyaraka hii'] } });
      }
      const realMime = detectMime(file.path);
      if (!realMime) {
        cleanup();
        return res.status(400).json({ error: 'Faili si PDF, JPG au PNG halali', details: { [field]: ['Faili si halali'] } });
      }
      docRows.push({
        type: docType,
        originalName: file.originalname.slice(0, 255),
        storageKey: file.filename,
        mimeType: realMime, // trust the detected type, not the browser's claim
        sizeBytes: file.size,
      });
    }

    // 3. Hash the password and create everything atomically
    const passwordHash = await bcrypt.hash(d.password, BCRYPT_ROUNDS);
    const applicationRef = newApplicationRef();

    const vendor = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: d.email, passwordHash, fullName: d.ownerName, role: 'vendor' },
      });

      return tx.vendor.create({
        data: {
          userId: user.id,
          storeName: d.businessName,
          storeSlug: slugify(d.businessName),
          storeDescription: d.description || null,
          status: 'pending',
          applicationRef,
          businessType: d.businessType,
          region: d.region,
          location: d.location,
          categories: d.categories,
          ownerPhone: d.phone,
          tin: d.tin,
          nidaNumberEncrypted: encryptField(d.nida),
          payoutProvider: d.payoutProvider,
          payoutPhone: d.payoutPhone,
          payoutAccountName: d.payoutName,
          documents: { create: docRows },
          history: { create: { fromStatus: null, toStatus: 'pending', reason: 'Application submitted' } },
        },
      });
    });

    // 4. Confirmation SMS (never blocks or fails the registration)
    sendSms({
      to: d.phone,
      template: 'application_received',
      data: { name: d.ownerName.split(' ')[0], ref: applicationRef },
      vendorId: vendor.id,
    });

    res.status(201).json({ applicationRef, status: 'pending' });
  } catch (err) {
    cleanup();
    if (err.code === 'P2002') {
      // Unique-constraint violation: tell the applicant which value is already taken
      const target = String(err.meta?.target ?? '');
      if (target.includes('email')) return res.status(409).json({ error: 'Barua pepe hii tayari imesajiliwa' });
      if (target.includes('tin')) return res.status(409).json({ error: 'TIN hii tayari imesajiliwa na biashara nyingine' });
    }
    console.error('registerVendor error:', err);
    res.status(500).json({ error: 'Imeshindikana kutuma ombi. Jaribu tena.' });
  }
}

const MAX_SHOPS = 5; // shops per owner that are pending or approved

/**
 * POST /api/vendors/me/shops   (multipart/form-data, vendor only)
 * An approved owner adds another shop. The owner's name, phone, NIDA, ID document and payout
 * account are reused from their first shop; the new shop brings its own name, location,
 * categories, TIN, business licence and TIN certificate. It starts as 'pending' and goes
 * through the same admin approval as any application.
 */
async function createShop(req, res) {
  const files = uploadedFiles(req);
  const copied = [];
  const cleanup = () => { files.forEach((f) => deleteStoredFile(f.filename)); copied.forEach(deleteStoredFile); };
  const fail = (status, body) => { cleanup(); return res.status(status).json(body); };

  try {
    const shops = await ownerShops(req.user.id);
    const first = shops[0];
    if (!first) return fail(404, { error: 'Hakuna wasifu wa muuzaji kwa akaunti hii' });
    if (!shops.some((s) => s.status === 'active')) {
      return fail(403, { error: 'Duka lako la kwanza lazima liidhinishwe kwanza kabla ya kuongeza duka jipya.' });
    }
    if (shops.filter((s) => s.status === 'pending' || s.status === 'active' || s.status === 'suspended').length >= MAX_SHOPS) {
      return fail(409, { error: `Unaweza kuwa na maduka ${MAX_SHOPS} tu. Wasiliana na Sipiki kuongeza.` });
    }

    const parsed = newShopSchema.safeParse(parseMultipartBody(req.body));
    if (!parsed.success) return fail(400, { error: 'Taarifa si sahihi', details: parsed.error.flatten().fieldErrors });
    const d = parsed.data;

    // Categories must be open for registration right now (same rule as a first application)
    const active = await prisma.businessCategory.findMany({ where: { isActive: true }, select: { name: true } });
    const canonical = new Map(active.map((c) => [c.name.toLowerCase(), c.name]));
    const chosen = d.categories.map((c) => canonical.get(c.toLowerCase()));
    if (chosen.some((c) => !c)) {
      return fail(400, { error: 'Kundi ulilochagua halipatikani kwa sasa', details: { categories: ['Kundi hili halipokei maombi kwa sasa. Chagua kundi jingine.'] } });
    }
    d.categories = [...new Set(chosen)];

    // The new shop needs its OWN licence and TIN certificate
    const docRows = [];
    for (const [field, docType] of [['licenseDoc', 'business_license'], ['tinDoc', 'tin_certificate']]) {
      const file = req.files?.[field]?.[0];
      if (!file) return fail(400, { error: 'Leseni na cheti cha TIN cha duka hili vinahitajika', details: { [field]: ['Pakia nyaraka hii'] } });
      const realMime = detectMime(file.path);
      if (!realMime) return fail(400, { error: 'Faili si PDF, JPG au PNG halali', details: { [field]: ['Faili si halali'] } });
      docRows.push({ type: docType, originalName: file.originalname.slice(0, 255), storageKey: file.filename, mimeType: realMime, sizeBytes: file.size });
    }
    // A stray idDoc upload is ignored: the owner's ID on file is reused
    if (req.files?.idDoc?.[0]) deleteStoredFile(req.files.idDoc[0].filename);

    // Reuse the owner's ID document: copy the file so each shop's record stands on its own
    const idDoc = await prisma.vendorDocument.findFirst({ where: { vendorId: first.id, type: 'owner_id' } });
    if (!idDoc) return fail(409, { error: 'Kitambulisho chako hakipatikani kwenye kumbukumbu. Wasiliana na Sipiki.' });
    const newKey = crypto.randomBytes(24).toString('hex');
    try {
      fs.copyFileSync(storedFilePath(idDoc.storageKey), storedFilePath(newKey));
      copied.push(newKey);
    } catch {
      return fail(409, { error: 'Kitambulisho chako hakipatikani kwenye hifadhi. Wasiliana na Sipiki.' });
    }
    docRows.push({ type: 'owner_id', originalName: idDoc.originalName, storageKey: newKey, mimeType: idDoc.mimeType, sizeBytes: idDoc.sizeBytes });

    const applicationRef = newApplicationRef();
    const vendor = await prisma.vendor.create({
      data: {
        userId: req.user.id,
        storeName: d.businessName,
        storeSlug: slugify(d.businessName),
        storeDescription: d.description || null,
        status: 'pending',
        applicationRef,
        businessType: d.businessType,
        region: d.region,
        location: d.location,
        categories: d.categories,
        ownerPhone: first.ownerPhone,
        tin: d.tin,
        nidaNumberEncrypted: first.nidaNumberEncrypted, // same owner, same NIDA (stays encrypted)
        payoutProvider: first.payoutProvider,
        payoutPhone: first.payoutPhone,
        payoutAccountName: first.payoutAccountName,
        documents: { create: docRows },
        history: { create: { fromStatus: null, toStatus: 'pending', reason: `Additional shop added by existing owner (first shop: ${first.applicationRef || first.id})` } },
      },
      select: { id: true, applicationRef: true, status: true, storeName: true },
    });

    sendSms({ to: first.ownerPhone, template: 'application_received', data: { name: d.businessName, ref: applicationRef }, vendorId: vendor.id });
    console.info(`[audit] owner ${req.user.id} added shop ${vendor.id} (${d.businessName})`);
    res.status(201).json({ shop: vendor });
  } catch (err) {
    cleanup();
    if (err.code === 'P2002') {
      const target = String(err.meta?.target ?? '');
      if (target.includes('tin')) return res.status(409).json({ error: 'TIN hii tayari imesajiliwa. Kila duka linahitaji TIN yake.', details: { tin: ['TIN hii tayari imesajiliwa'] } });
    }
    console.error('createShop error:', err);
    res.status(500).json({ error: 'Imeshindikana kutuma ombi la duka. Jaribu tena.' });
  }
}

module.exports = { handleUpload, registerVendor, listCategories, createShop };
