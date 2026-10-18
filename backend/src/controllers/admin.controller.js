// ============================================================================
// Admin Controller — review applications, manage vendors, dashboard numbers.
// Every route using this is behind authenticate + requireAdmin (admin.routes.js).
//
// Status lifecycle (matches the vendor_status enum and the admin UI):
//   pending ──approve──▶ active ◀──reactivate── suspended
//      │                    └────────suspend────────▲
//      └──reject──▶ rejected
// ============================================================================
const fs = require('fs');
const prisma = require('../config/db');
const { reasonSchema } = require('../validators/vendor.validators');
const { sendSms } = require('../services/sms.service');
const { decryptField, maskTail } = require('../utils/crypto');
const { storedFilePath } = require('../config/upload');

// Orders in these states count as real sales (not pending/cancelled/refunded)
const SALE_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

const VENDOR_LIST_SELECT = {
  id: true, storeName: true, status: true, applicationRef: true, region: true, location: true,
  businessType: true, categories: true, createdAt: true, reviewedAt: true,
  rejectionReason: true, suspensionReason: true,
  user: { select: { fullName: true, email: true } },
  ownerPhone: true,
};

// ---- shared status-transition logic ---------------------------------------

/**
 * Moves a vendor between statuses safely.
 *  - The UPDATE is conditional on the current status (`where: { status: from }`),
 *    so two admins clicking at once, or a double-click, can't both succeed.
 *  - The status change and its history row are written in one transaction.
 *  - The SMS is sent only after the transaction commits, and never blocks it.
 */
async function transition(req, res, { from, to, reason, fields, template }) {
  const { id } = req.params;
  try {
    const changed = await prisma.$transaction(async (tx) => {
      const result = await tx.vendor.updateMany({
        where: { id, status: from },
        data: { status: to, reviewedBy: req.user.id, reviewedAt: new Date(), ...fields },
      });
      if (result.count === 0) return false;

      await tx.vendorStatusHistory.create({
        data: { vendorId: id, fromStatus: from, toStatus: to, reason: reason ?? null, changedBy: req.user.id },
      });
      return true;
    });

    if (!changed) {
      const current = await prisma.vendor.findUnique({ where: { id }, select: { status: true } });
      if (!current) return res.status(404).json({ error: 'Muuzaji hajapatikana' });
      return res.status(409).json({ error: `Hatua hii haiwezekani — hali ya sasa ni "${current.status}"`, status: current.status });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: { ...VENDOR_LIST_SELECT, user: { select: { fullName: true, email: true } } },
    });

    // Business-name templates (suspended/reactivated) vs. person-name templates (approved/rejected)
    const firstName = vendor.user.fullName.split(' ')[0];
    const name = ['suspended', 'reactivated'].includes(template) ? vendor.storeName : firstName;
    sendSms({ to: vendor.ownerPhone, template, data: { name, reason }, vendorId: id });

    res.json({ vendor });
  } catch (err) {
    console.error(`transition ${from}→${to} error:`, err);
    res.status(500).json({ error: 'Imeshindikana kubadilisha hali ya muuzaji' });
  }
}

// ---- reads -----------------------------------------------------------------

/** GET /api/admin/stats — numbers for the overview tab */
async function getStats(_req, res) {
  try {
    const saleFilter = { order: { status: { in: SALE_STATUSES } } };
    const [byStatus, sales, orders, commission] = await Promise.all([
      prisma.vendor.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.orderItem.aggregate({ _sum: { subtotalCents: true }, where: saleFilter }),
      prisma.order.count({ where: { status: { in: SALE_STATUSES } } }),
      prisma.vendorPayout.aggregate({ _sum: { platformFeeCents: true } }),
    ]);

    const counts = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));
    res.json({
      vendors: { active: counts.active ?? 0, pending: counts.pending ?? 0, suspended: counts.suspended ?? 0, rejected: counts.rejected ?? 0 },
      totalSalesCents: sales._sum.subtotalCents ?? 0,
      ordersCount: orders,
      commissionCents: commission._sum.platformFeeCents ?? 0,
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata takwimu' });
  }
}

/** GET /api/admin/applications — pending queue, oldest first (first come, first reviewed) */
async function listApplications(_req, res) {
  try {
    const applications = await prisma.vendor.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: { ...VENDOR_LIST_SELECT, documents: { select: { id: true, type: true, originalName: true } } },
    });
    res.json({ data: applications });
  } catch (err) {
    console.error('listApplications error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata maombi' });
  }
}

/** GET /api/admin/vendors?status=&q=&page=&limit= — reviewed vendors (everything except pending by default) */
async function listVendors(req, res) {
  try {
    const { status, q, page = 1, limit = 20 } = req.query;
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where = {
      status: ['active', 'suspended', 'rejected', 'pending'].includes(status) ? status : { not: 'pending' },
      ...(q && {
        OR: [
          { storeName: { contains: String(q), mode: 'insensitive' } },
          { region: { contains: String(q), mode: 'insensitive' } },
          { user: { fullName: { contains: String(q), mode: 'insensitive' } } },
        ],
      }),
    };

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({ where, take, skip, orderBy: { createdAt: 'desc' }, select: VENDOR_LIST_SELECT }),
      prisma.vendor.count({ where }),
    ]);

    // Sales + order counts for just this page of vendors, in one grouped query
    const totals = await prisma.orderItem.groupBy({
      by: ['vendorId'],
      where: { vendorId: { in: vendors.map((v) => v.id) }, order: { status: { in: SALE_STATUSES } } },
      _sum: { subtotalCents: true },
      _count: { _all: true },
    });
    const byVendor = Object.fromEntries(totals.map((t) => [t.vendorId, t]));

    res.json({
      data: vendors.map((v) => ({
        ...v,
        salesCents: byVendor[v.id]?._sum.subtotalCents ?? 0,
        itemsSold: byVendor[v.id]?._count._all ?? 0,
      })),
      pagination: { page: Number(page) || 1, limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) {
    console.error('listVendors error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata wauzaji' });
  }
}

/** GET /api/admin/vendors/:id — full application detail incl. documents and history */
async function getVendor(req, res) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { fullName: true, email: true } },
        documents: { select: { id: true, type: true, originalName: true, mimeType: true, sizeBytes: true } },
        history: { orderBy: { createdAt: 'desc' }, include: { admin: { select: { fullName: true } } } },
      },
    });
    if (!vendor) return res.status(404).json({ error: 'Muuzaji hajapatikana' });

    // The full NIDA number never leaves the server — admins see only the last 4 digits
    let nidaMasked = null;
    try {
      if (vendor.nidaNumberEncrypted) nidaMasked = maskTail(decryptField(vendor.nidaNumberEncrypted));
    } catch (err) {
      console.error('NIDA decrypt failed for vendor', vendor.id, err.message);
    }

    const { nidaNumberEncrypted, ...safe } = vendor; // strip the ciphertext from the response
    res.json({ ...safe, nidaMasked });
  } catch (err) {
    console.error('getVendor error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata taarifa za muuzaji' });
  }
}

/**
 * GET /api/admin/vendors/:id/documents/:docId — streams a verification document.
 * The file path is looked up from the DB by id; nothing from the URL touches the filesystem.
 */
async function downloadDocument(req, res) {
  try {
    const doc = await prisma.vendorDocument.findFirst({
      where: { id: req.params.docId, vendorId: req.params.id },
    });
    if (!doc) return res.status(404).json({ error: 'Nyaraka haijapatikana' });

    const filePath = storedFilePath(doc.storageKey);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Faili haipo kwenye hifadhi' });

    console.info(`[audit] admin ${req.user.id} viewed document ${doc.id} of vendor ${doc.vendorId}`);

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox"); // a malicious file can't run script
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('downloadDocument error:', err);
    res.status(500).json({ error: 'Imeshindikana kufungua nyaraka' });
  }
}

// ---- status actions --------------------------------------------------------

/** POST /api/admin/vendors/:id/approve */
const approveVendor = (req, res) =>
  transition(req, res, {
    from: 'pending', to: 'active', template: 'approved',
    fields: { rejectionReason: null, suspensionReason: null },
  });

/** POST /api/admin/vendors/:id/reject   body: { reason } */
function rejectVendor(req, res) {
  const parsed = reasonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Sababu inahitajika', details: parsed.error.flatten().fieldErrors });
  const { reason } = parsed.data;
  return transition(req, res, { from: 'pending', to: 'rejected', reason, template: 'rejected', fields: { rejectionReason: reason } });
}

/** POST /api/admin/vendors/:id/suspend   body: { reason } */
function suspendVendor(req, res) {
  const parsed = reasonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Sababu inahitajika', details: parsed.error.flatten().fieldErrors });
  const { reason } = parsed.data;
  return transition(req, res, { from: 'active', to: 'suspended', reason, template: 'suspended', fields: { suspensionReason: reason } });
}

/** POST /api/admin/vendors/:id/reactivate */
const reactivateVendor = (req, res) =>
  transition(req, res, {
    from: 'suspended', to: 'active', template: 'reactivated',
    fields: { suspensionReason: null },
  });

module.exports = {
  getStats, listApplications, listVendors, getVendor, downloadDocument,
  approveVendor, rejectVendor, suspendVendor, reactivateVendor,
};
