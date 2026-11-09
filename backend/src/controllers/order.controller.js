// ============================================================================
// Orders — guest checkout (no account) and the seller's order handling.
//
//   POST /api/orders                              customer places an order: phone + location + items
//   POST /api/orders/track                        customer looks up an order by number + phone
//   GET  /api/vendors/me/orders                   seller: orders containing their products
//   PATCH /api/vendors/me/orders/:orderId/status  seller: confirm / ship / deliver / cancel
//
// Prices and stock always come from the database, never from the browser. Stock is taken
// inside the same transaction that creates the order, with a conditional update, so two
// customers can never buy the last item at the same time.
// Payment is on delivery for now (payment_method = 'on_delivery').
// ============================================================================
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { REGIONS } = require('../validators/vendor.validators');
const { sendSms } = require('../services/sms.service');
const { resolveShop } = require('../utils/shop');
const { variantLabel } = require('../utils/productDetails');

const MAX_INT = 2_147_483_647; // INTEGER column limit (cents)
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easy to read out over the phone

const phoneField = z.string().transform((v, ctx) => {
  const n = normalizePhone(v);
  if (!n) ctx.addIssue({ code: 'custom', message: 'Weka namba sahihi ya simu, mfano 0712 345 678' });
  return n;
});

const orderSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), quantity: z.number().int().min(1).max(50) }))
    .min(1, 'Kikapu kiko tupu')
    .max(20, 'Bidhaa ni nyingi mno kwa oda moja'),
  phone: phoneField,
  name: z.string().trim().max(80).optional().default(''),
  region: z.enum(REGIONS, { errorMap: () => ({ message: 'Chagua mkoa' }) }),
  location: z.string().trim().min(3, 'Andika eneo ulipo (mtaa, kata au jengo)').max(200, 'Maelezo ya eneo ni marefu mno'),
  notes: z.string().trim().max(300).optional().default(''),
});

const trackSchema = z.object({ ref: z.string().trim().toUpperCase().min(5).max(20), phone: phoneField });

class OrderError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

const tsh = (cents) => Math.round(cents / 100);
const money = (cents) => tsh(cents).toLocaleString('en-US');

function newRef() {
  const bytes = crypto.randomBytes(6);
  return 'SPK-' + [...bytes].map((b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}

/** The order's overall status follows its sellers' item statuses. */
function overallStatus(statuses) {
  const live = statuses.filter((s) => s !== 'cancelled');
  if (live.length === 0) return 'cancelled';
  if (live.every((s) => s === 'delivered')) return 'delivered';
  if (live.some((s) => s === 'shipped' || s === 'delivered')) return 'shipped';
  if (live.some((s) => s === 'processing')) return 'processing';
  return 'pending';
}

// ---- customer: place an order -------------------------------------------------

/** POST /api/orders */
async function createOrder(req, res) {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ error: first?.message || 'Taarifa si sahihi', details: parsed.error.flatten().fieldErrors });
  }
  const d = parsed.data;

  // Same product (and same size/colour) twice → one line
  const wanted = new Map();
  for (const it of d.items) {
    const key = `${it.productId}:${it.variantId || ''}`;
    const cur = wanted.get(key) || { productId: it.productId, variantId: it.variantId || null, quantity: 0 };
    cur.quantity += it.quantity;
    wanted.set(key, cur);
  }

  try {
    let order;
    let vendorsById;
    for (let attempt = 0; ; attempt += 1) {
      try {
        ({ order, vendorsById } = await prisma.$transaction(async (tx) => {
          const products = await tx.product.findMany({
            where: { id: { in: [...new Set([...wanted.values()].map((w) => w.productId))] }, isActive: true, deletedAt: null, vendor: { status: 'active' } },
            select: { id: true, title: true, priceCents: true, vendorId: true, variants: { select: { id: true, size: true, color: true } }, vendor: { select: { id: true, storeName: true, ownerPhone: true } } },
          });
          const byId = new Map(products.map((p) => [p.id, p]));
          const missing = [...wanted.values()].filter((w) => !byId.has(w.productId)).map((w) => w.productId);
          if (missing.length) throw new OrderError(409, 'Bidhaa moja au zaidi haipatikani tena dukani.', { unavailable: missing });

          let total = 0;
          const lines = [];
          for (const { productId, variantId, quantity } of wanted.values()) {
            const p = byId.get(productId);
            let variant = null;
            if (p.variants.length > 0) {
              if (!variantId) throw new OrderError(400, `Chagua saizi au rangi ya "${p.title}" kwanza.`, { unavailable: [productId] });
              variant = p.variants.find((v) => v.id === variantId);
              if (!variant) throw new OrderError(409, `Chaguo ulilochagua la "${p.title}" halipatikani tena.`, { unavailable: [productId] });
            } else if (variantId) {
              throw new OrderError(409, `Chaguo ulilochagua la "${p.title}" halipatikani tena.`, { unavailable: [productId] });
            }
            const subtotal = p.priceCents * quantity;
            if (subtotal > MAX_INT) throw new OrderError(400, 'Jumla ni kubwa mno kwa oda moja.');
            total += subtotal;
            lines.push({ p, variant, label: variant ? variantLabel(variant) : null, quantity, subtotal });
          }
          if (total > MAX_INT) throw new OrderError(400, 'Jumla ni kubwa mno kwa oda moja. Gawanya oda mbili.');

          // Take the stock; the condition makes this safe against two buyers at once
          for (const { p, variant, label, quantity } of lines) {
            const what = label ? `"${p.title}" (${label})` : `"${p.title}"`;
            if (variant) {
              const takenVariant = await tx.productVariant.updateMany({ where: { id: variant.id, stockQuantity: { gte: quantity } }, data: { stockQuantity: { decrement: quantity } } });
              if (takenVariant.count === 0) throw new OrderError(409, `${what} haitoshi tena kwa idadi uliyochagua.`, { unavailable: [p.id] });
            }
            // The product's own number is the total of all its sizes/colours, so it goes down too
            const taken = await tx.product.updateMany({ where: { id: p.id, stockQuantity: { gte: quantity } }, data: { stockQuantity: { decrement: quantity } } });
            if (taken.count === 0) throw new OrderError(409, `${what} haitoshi tena kwa idadi uliyochagua.`, { unavailable: [p.id] });
          }

          const created = await tx.order.create({
            data: {
              orderRef: newRef(),
              customerName: d.name || null,
              customerPhone: d.phone,
              paymentMethod: 'on_delivery',
              status: 'pending',
              subtotalCents: total,
              platformFeeCents: 0,
              totalCents: total,
              currency: 'TZS',
              shippingAddress: { region: d.region, location: d.location, notes: d.notes || null },
              items: {
                create: lines.map(({ p, variant, label, quantity, subtotal }) => ({
                  productId: p.id, vendorId: p.vendorId, productTitle: p.title, variantId: variant?.id ?? null, variantLabel: label, quantity, unitPriceCents: p.priceCents, subtotalCents: subtotal,
                })),
              },
            },
            select: { id: true, orderRef: true, totalCents: true, items: { select: { productTitle: true, variantLabel: true, quantity: true, unitPriceCents: true, vendorId: true, subtotalCents: true } } },
          });
          return { order: created, vendorsById: new Map(products.map((p) => [p.vendor.id, p.vendor])) };
        }));
        break;
      } catch (err) {
        if (err.code === 'P2002' && attempt < 4) continue; // the random order number collided — pick another
        throw err;
      }
    }

    // Messages go out after the order is safely saved; a failed SMS never undoes the order
    notifyNewOrder(order, vendorsById, d).catch((e) => console.error('order SMS error:', e));

    res.status(201).json({
      order: {
        ref: order.orderRef,
        totalTsh: tsh(order.totalCents),
        items: order.items.map((i) => ({ title: i.productTitle, option: i.variantLabel, quantity: i.quantity, unitPriceTsh: tsh(i.unitPriceCents) })),
        paymentMethod: 'on_delivery',
      },
    });
  } catch (err) {
    if (err instanceof OrderError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    console.error('createOrder error:', err);
    res.status(500).json({ error: 'Imeshindikana kutuma oda. Jaribu tena.' });
  }
}

async function notifyNewOrder(order, vendorsById, d) {
  await sendSms({ to: d.phone, template: 'order_placed', data: { ref: order.orderRef, total: money(order.totalCents) } });
  const perVendor = new Map();
  for (const it of order.items) {
    const cur = perVendor.get(it.vendorId) || { count: 0, total: 0 };
    cur.count += it.quantity;
    cur.total += it.subtotalCents;
    perVendor.set(it.vendorId, cur);
  }
  for (const [vendorId, agg] of perVendor) {
    const v = vendorsById.get(vendorId);
    if (!v?.ownerPhone) continue;
    await sendSms({
      to: v.ownerPhone, vendorId, template: 'new_order',
      data: { name: v.storeName, ref: order.orderRef, count: agg.count, total: money(agg.total), customer: d.name ? `${d.name} ${d.phone}` : d.phone },
    });
  }
}

// ---- customer: track ----------------------------------------------------------

/** POST /api/orders/track   body: { ref, phone } — both must match, so an order number alone reveals nothing */
async function trackOrder(req, res) {
  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Weka namba ya oda na namba ya simu' });
  try {
    const order = await prisma.order.findFirst({
      where: { orderRef: parsed.data.ref, customerPhone: parsed.data.phone },
      select: {
        orderRef: true, status: true, totalCents: true, createdAt: true, shippingAddress: true,
        items: { select: { productTitle: true, variantLabel: true, quantity: true, unitPriceCents: true, fulfillmentStatus: true, vendor: { select: { storeName: true } } } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Oda haijapatikana. Angalia namba ya oda na namba ya simu uliyotumia.' });
    res.json({
      order: {
        ref: order.orderRef, status: order.status, createdAt: order.createdAt, totalTsh: tsh(order.totalCents),
        location: `${order.shippingAddress?.location || ''}, ${order.shippingAddress?.region || ''}`,
        items: order.items.map((i) => ({ title: i.productTitle, option: i.variantLabel, quantity: i.quantity, unitPriceTsh: tsh(i.unitPriceCents), status: i.fulfillmentStatus, store: i.vendor?.storeName })),
      },
    });
  } catch (err) {
    console.error('trackOrder error:', err);
    res.status(500).json({ error: 'Imeshindikana kutafuta oda' });
  }
}

// ---- seller: see and handle their orders --------------------------------------

async function activeVendorOf(req, res) {
  const { vendor, missing } = await resolveShop(req);
  if (!vendor) {
    res.status(404).json(missing ? { error: 'Duka hili halipatikani kwenye akaunti yako', code: 'shop_not_found' } : { error: 'Hakuna wasifu wa muuzaji kwa akaunti hii' });
    return null;
  }
  if (vendor.status !== 'active') { res.status(403).json({ error: 'Akaunti yako haijaidhinishwa au imesimamishwa', status: vendor.status }); return null; }
  return vendor;
}

/** GET /api/vendors/me/orders */
async function listVendorOrders(req, res) {
  try {
    const vendor = await activeVendorOf(req, res);
    if (!vendor) return;
    const rows = await prisma.order.findMany({
      where: { items: { some: { vendorId: vendor.id } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, orderRef: true, createdAt: true, customerName: true, customerPhone: true, shippingAddress: true, paymentMethod: true,
        items: { where: { vendorId: vendor.id }, select: { productTitle: true, variantLabel: true, quantity: true, unitPriceCents: true, subtotalCents: true, fulfillmentStatus: true } },
      },
    });
    res.json({
      data: rows.map((o) => ({
        id: o.id,
        ref: o.orderRef,
        createdAt: o.createdAt,
        customer: { name: o.customerName, phone: o.customerPhone },
        delivery: { region: o.shippingAddress?.region, location: o.shippingAddress?.location, notes: o.shippingAddress?.notes || null },
        paymentMethod: o.paymentMethod,
        status: o.items[0]?.fulfillmentStatus || 'pending',
        subtotalTsh: tsh(o.items.reduce((s, i) => s + i.subtotalCents, 0)),
        items: o.items.map((i) => ({ title: i.productTitle, option: i.variantLabel, quantity: i.quantity, unitPriceTsh: tsh(i.unitPriceCents), subtotalTsh: tsh(i.subtotalCents) })),
      })),
    });
  } catch (err) {
    console.error('listVendorOrders error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata maagizo' });
  }
}

// What a seller may do next with their part of an order
const NEXT = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
};
const statusSchema = z.object({ status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']) });
const STATUS_SMS = { processing: 'order_processing', shipped: 'order_shipped', delivered: 'order_delivered', cancelled: 'order_cancelled' };

/** PATCH /api/vendors/me/orders/:orderId/status   body: { status } */
async function updateVendorOrderStatus(req, res) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Hali si sahihi' });
  const to = parsed.data.status;
  try {
    const vendor = await activeVendorOf(req, res);
    if (!vendor) return;
    const orderId = req.params.orderId;

    const result = await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: { orderId, vendorId: vendor.id },
        select: { id: true, productId: true, variantId: true, quantity: true, fulfillmentStatus: true },
      });
      if (items.length === 0) throw new OrderError(404, 'Oda haijapatikana');
      const from = items[0].fulfillmentStatus;
      if (!(NEXT[from] || []).includes(to)) throw new OrderError(409, 'Hatua hii haiwezekani — hali ya oda imebadilika.', { status: from });

      // Conditional on the current status, so a double click or two devices can't apply it twice
      const changed = await tx.orderItem.updateMany({ where: { orderId, vendorId: vendor.id, fulfillmentStatus: from }, data: { fulfillmentStatus: to } });
      if (changed.count === 0) throw new OrderError(409, 'Hali ya oda imebadilika tayari.');

      if (to === 'cancelled') {
        for (const it of items) {
          if (it.variantId) {
            await tx.productVariant.update({ where: { id: it.variantId }, data: { stockQuantity: { increment: it.quantity } } });
            await tx.product.update({ where: { id: it.productId }, data: { stockQuantity: { increment: it.quantity } } });
          } else if ((await tx.productVariant.count({ where: { productId: it.productId } })) === 0) {
            await tx.product.update({ where: { id: it.productId }, data: { stockQuantity: { increment: it.quantity } } });
          } // else: the seller removed that size after the order, so there is no stock line to put it back on
        }
      }
      const all = await tx.orderItem.findMany({ where: { orderId }, select: { fulfillmentStatus: true } });
      const status = overallStatus(all.map((i) => i.fulfillmentStatus));
      const order = await tx.order.update({ where: { id: orderId }, data: { status }, select: { orderRef: true, customerPhone: true } });
      return { order, status: to };
    });

    sendSms({ to: result.order.customerPhone, template: STATUS_SMS[to], data: { ref: result.order.orderRef, store: vendor.storeName } })
      .catch((e) => console.error('order status SMS error:', e));
    res.json({ status: result.status });
  } catch (err) {
    if (err instanceof OrderError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    console.error('updateVendorOrderStatus error:', err);
    res.status(500).json({ error: 'Imeshindikana kubadilisha hali ya oda' });
  }
}

module.exports = { createOrder, trackOrder, listVendorOrders, updateVendorOrderStatus };
