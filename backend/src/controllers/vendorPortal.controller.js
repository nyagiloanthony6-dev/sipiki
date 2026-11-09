// ============================================================================
// Vendor portal — what a registered business sees and does after signing in.
//
//   GET    /api/vendors/me                      own application / business details
//   GET    /api/vendors/me/summary              numbers for the overview tab
//   GET    /api/vendors/me/categories           product categories this vendor may list in
//   GET    /api/vendors/me/products             own products (hidden ones included)
//   POST   /api/vendors/me/products             add a product            (approved vendors only)
//   PATCH  /api/vendors/me/products/:id         edit / hide / show       (approved vendors only)
//   DELETE /api/vendors/me/products/:id         remove from the shop     (approved vendors only)
//   POST   /api/vendors/me/products/:id/images  add a photo (max 4)      (approved vendors only)
//   DELETE /api/vendors/me/products/:id/images/:imageId
//
// Every query is scoped by the vendor found from the signed-in user's id, so a
// vendor can never read or change another vendor's products.
// ============================================================================
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../config/db');
const { uploadProductImage, detectImageMime, processProductImage, deleteImageFile } = require('../config/upload');

const MAX_IMAGES = 4;
const SALE_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

// Prices are entered in whole shillings and stored as cents (x100) in an INTEGER column,
// so the largest price that fits is about TSh 21 million.
const MAX_PRICE_TSH = 20_000_000;

const productSchema = z.object({
  title: z.string().trim().min(3, 'Jina la bidhaa liwe na herufi angalau 3').max(120, 'Jina ni refu mno'),
  description: z.string().trim().max(2000, 'Maelezo ni marefu mno').optional().default(''),
  priceTsh: z.number({ invalid_type_error: 'Weka bei kwa namba' }).int('Bei iwe namba kamili').min(100, 'Bei ya chini ni TSh 100').max(MAX_PRICE_TSH, 'Bei ni kubwa mno'),
  stockQuantity: z.number({ invalid_type_error: 'Weka idadi kwa namba' }).int().min(0, 'Idadi haiwezi kuwa hasi').max(100000, 'Idadi ni kubwa mno'),
  categoryId: z.string().uuid('Chagua kundi la bidhaa'),
  isActive: z.boolean().optional().default(true),
});
const productUpdateSchema = productSchema.partial();

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const PRODUCT_SELECT = {
  id: true, title: true, slug: true, description: true, priceCents: true, currency: true,
  stockQuantity: true, isActive: true, createdAt: true,
  category: { select: { id: true, name: true } },
  images: { orderBy: { position: 'asc' }, select: { id: true, url: true } },
};

// ---- helpers ---------------------------------------------------------------

/** The vendor row belonging to the signed-in user (or sends 404 and returns null). */
async function myVendor(req, res) {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
  if (!vendor) {
    res.status(404).json({ error: 'Hakuna wasifu wa muuzaji kwa akaunti hii' });
    return null;
  }
  return vendor;
}

/** Like myVendor, but also requires the vendor to be approved. Sends 403 otherwise. */
async function activeVendor(req, res) {
  const vendor = await myVendor(req, res);
  if (!vendor) return null;
  if (vendor.status !== 'active') {
    res.status(403).json({ error: 'Akaunti yako haijaidhinishwa au imesimamishwa', status: vendor.status });
    return null;
  }
  return vendor;
}

/** Product categories this vendor registered under (matched by name, ignoring letter case). */
async function allowedCategories(vendor) {
  const wanted = (vendor.categories || []).map((c) => c.toLowerCase());
  if (wanted.length === 0) return [];
  const all = await prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  return all.filter((c) => wanted.includes(c.name.toLowerCase()));
}

const withMoney = (p) => ({ ...p, priceTsh: Math.round(p.priceCents / 100) });

// ---- reads -----------------------------------------------------------------

/** GET /api/vendors/me */
async function getMe(req, res) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
      select: {
        id: true, storeName: true, storeSlug: true, status: true, applicationRef: true,
        rejectionReason: true, suspensionReason: true, createdAt: true, reviewedAt: true,
        businessType: true, region: true, location: true, categories: true, ownerPhone: true, tin: true,
        payoutProvider: true, payoutPhone: true, payoutAccountName: true,
        user: { select: { fullName: true, email: true } },
        documents: { select: { type: true, originalName: true } },
      },
    });
    if (!vendor) return res.status(404).json({ error: 'Hakuna wasifu wa muuzaji kwa akaunti hii' });
    res.json(vendor);
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata taarifa' });
  }
}

/** GET /api/vendors/me/summary */
async function getSummary(req, res) {
  try {
    const vendor = await myVendor(req, res);
    if (!vendor) return;
    const own = { vendorId: vendor.id, deletedAt: null };
    const [products, activeProducts, sales, orders, newOrders] = await Promise.all([
      prisma.product.count({ where: own }),
      prisma.product.count({ where: { ...own, isActive: true } }),
      prisma.orderItem.aggregate({ _sum: { subtotalCents: true }, where: { vendorId: vendor.id, order: { status: { in: SALE_STATUSES } } } }),
      prisma.orderItem.count({ where: { vendorId: vendor.id, order: { status: { in: SALE_STATUSES } } } }),
      prisma.orderItem.count({ where: { vendorId: vendor.id, fulfillmentStatus: 'pending' } }),
    ]);
    res.json({
      products, activeProducts, ordersCount: orders, newOrders,
      salesTsh: Math.round((sales._sum.subtotalCents ?? 0) / 100),
    });
  } catch (err) {
    console.error('getSummary error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata takwimu' });
  }
}

/** GET /api/vendors/me/categories */
async function getMyCategories(req, res) {
  try {
    const vendor = await myVendor(req, res);
    if (!vendor) return;
    res.json({ data: await allowedCategories(vendor) });
  } catch (err) {
    console.error('getMyCategories error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata makundi' });
  }
}

/** GET /api/vendors/me/products */
async function listMyProducts(req, res) {
  try {
    const vendor = await myVendor(req, res);
    if (!vendor) return;
    const rows = await prisma.product.findMany({
      where: { vendorId: vendor.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: PRODUCT_SELECT,
    });
    res.json({ data: rows.map(withMoney) });
  } catch (err) {
    console.error('listMyProducts error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata bidhaa' });
  }
}

// ---- product writes --------------------------------------------------------

/** POST /api/vendors/me/products */
async function createProduct(req, res) {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Taarifa za bidhaa si sahihi', details: parsed.error.flatten().fieldErrors });
  const d = parsed.data;
  try {
    const vendor = await activeVendor(req, res);
    if (!vendor) return;

    const allowed = await allowedCategories(vendor);
    if (!allowed.some((c) => c.id === d.categoryId)) {
      return res.status(400).json({ error: 'Kundi hili haliruhusiwi kwa biashara yako', details: { categoryId: ['Chagua kundi ulilosajiliwa nalo'] } });
    }

    // A readable address for the product page; a short random tail keeps it unique
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const product = await prisma.product.create({
          data: {
            vendorId: vendor.id,
            categoryId: d.categoryId,
            title: d.title,
            slug: `${slugify(d.title) || 'bidhaa'}-${crypto.randomBytes(3).toString('hex')}`,
            description: d.description || null,
            priceCents: d.priceTsh * 100,
            currency: 'TZS',
            stockQuantity: d.stockQuantity,
            isActive: d.isActive,
          },
          select: PRODUCT_SELECT,
        });
        return res.status(201).json({ product: withMoney(product) });
      } catch (err) {
        if (err.code !== 'P2002') throw err; // slug clash → try again with a new tail
      }
    }
    res.status(500).json({ error: 'Imeshindikana kuhifadhi bidhaa. Jaribu tena.' });
  } catch (err) {
    console.error('createProduct error:', err);
    res.status(500).json({ error: 'Imeshindikana kuhifadhi bidhaa' });
  }
}

/** PATCH /api/vendors/me/products/:id */
async function updateProduct(req, res) {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Taarifa za bidhaa si sahihi', details: parsed.error.flatten().fieldErrors });
  const d = parsed.data;
  try {
    const vendor = await activeVendor(req, res);
    if (!vendor) return;

    if (d.categoryId) {
      const allowed = await allowedCategories(vendor);
      if (!allowed.some((c) => c.id === d.categoryId)) {
        return res.status(400).json({ error: 'Kundi hili haliruhusiwi kwa biashara yako', details: { categoryId: ['Chagua kundi ulilosajiliwa nalo'] } });
      }
    }

    const data = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.description !== undefined) data.description = d.description || null;
    if (d.priceTsh !== undefined) data.priceCents = d.priceTsh * 100;
    if (d.stockQuantity !== undefined) data.stockQuantity = d.stockQuantity;
    if (d.categoryId !== undefined) data.categoryId = d.categoryId;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    // The vendor id in the WHERE clause is what stops anyone editing someone else's product
    const result = await prisma.product.updateMany({ where: { id: req.params.id, vendorId: vendor.id, deletedAt: null }, data });
    if (result.count === 0) return res.status(404).json({ error: 'Bidhaa haijapatikana' });

    const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: PRODUCT_SELECT });
    res.json({ product: withMoney(product) });
  } catch (err) {
    console.error('updateProduct error:', err);
    res.status(500).json({ error: 'Imeshindikana kubadilisha bidhaa' });
  }
}

/** DELETE /api/vendors/me/products/:id — removed from the shop (kept in the database for past orders) */
async function deleteProduct(req, res) {
  try {
    const vendor = await activeVendor(req, res);
    if (!vendor) return;
    const result = await prisma.product.updateMany({
      where: { id: req.params.id, vendorId: vendor.id, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Bidhaa haijapatikana' });
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteProduct error:', err);
    res.status(500).json({ error: 'Imeshindikana kufuta bidhaa' });
  }
}

// ---- photos ----------------------------------------------------------------

/** Runs multer and turns its errors into clean 400 responses. */
function handleImageUpload(req, res, next) {
  uploadProductImage(req, res, (err) => {
    if (!err) return next();
    if (req.file) deleteImageFile(req.file.filename);
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Picha ni kubwa mno (kiwango ni 5 MB)' : err.message || 'Imeshindikana kupakia picha';
    res.status(400).json({ error: message });
  });
}

/** POST /api/vendors/me/products/:id/images   (multipart, field "image") */
async function addImage(req, res) {
  const file = req.file;
  const discard = () => file && deleteImageFile(file.filename);
  try {
    if (!file) return res.status(400).json({ error: 'Chagua picha ya kupakia' });

    const vendor = await activeVendor(req, res);
    if (!vendor) return discard();

    const mime = detectImageMime(file.path);
    if (!mime) {
      discard();
      return res.status(400).json({ error: 'Faili si picha halali ya JPG, PNG au WebP' });
    }

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, vendorId: vendor.id, deletedAt: null },
      select: { id: true, _count: { select: { images: true } } },
    });
    if (!product) {
      discard();
      return res.status(404).json({ error: 'Bidhaa haijapatikana' });
    }
    if (product._count.images >= MAX_IMAGES) {
      discard();
      return res.status(400).json({ error: `Unaweza kuweka picha ${MAX_IMAGES} tu kwa kila bidhaa` });
    }

    // Make the smaller copies; a file that cannot be decoded as a picture is refused here
    let storedMime;
    try {
      storedMime = await processProductImage(file.filename);
    } catch {
      discard();
      return res.status(400).json({ error: 'Picha hii haisomeki. Jaribu picha nyingine.' });
    }

    const image = await prisma.productImage.create({
      data: {
        productId: product.id,
        url: `/api/media/${file.filename}`, // relative; the website adds the API address in front
        storageKey: file.filename,
        mimeType: storedMime,
        position: product._count.images,
      },
      select: { id: true, url: true },
    });
    res.status(201).json({ image });
  } catch (err) {
    discard();
    console.error('addImage error:', err);
    res.status(500).json({ error: 'Imeshindikana kupakia picha' });
  }
}

/** DELETE /api/vendors/me/products/:id/images/:imageId */
async function deleteImage(req, res) {
  try {
    const vendor = await activeVendor(req, res);
    if (!vendor) return;
    const image = await prisma.productImage.findFirst({
      where: { id: req.params.imageId, productId: req.params.id, product: { vendorId: vendor.id, deletedAt: null } },
      select: { id: true, storageKey: true },
    });
    if (!image) return res.status(404).json({ error: 'Picha haijapatikana' });
    await prisma.productImage.delete({ where: { id: image.id } });
    if (image.storageKey) deleteImageFile(image.storageKey);
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteImage error:', err);
    res.status(500).json({ error: 'Imeshindikana kufuta picha' });
  }
}

const myCategoriesSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(80)).min(1, 'Chagua angalau kundi moja').max(30),
});

/**
 * PATCH /api/vendors/me/categories   body: { categories: [name, ...] }
 * An approved seller adds or removes their own business categories.
 *  - A category can be ADDED only while the admin has it open for registration.
 *  - A category the seller already has can always be removed (even if the admin closed it since).
 *  - At least one must remain. Products already listed stay; the seller just can't add new ones in a removed category.
 */
async function updateMyCategories(req, res) {
  const parsed = myCategoriesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Chagua angalau kundi moja' });
  try {
    const vendor = await activeVendor(req, res);
    if (!vendor) return;

    const known = await prisma.businessCategory.findMany({ select: { name: true, isActive: true } });
    const byLower = new Map(known.map((c) => [c.name.toLowerCase(), c]));
    const unknown = parsed.data.categories.filter((c) => !byLower.has(c.toLowerCase()));
    if (unknown.length) return res.status(400).json({ error: `Kundi halipo: ${unknown.join(', ')}` });

    const chosen = [...new Set(parsed.data.categories.map((c) => byLower.get(c.toLowerCase()).name))];
    const current = new Set((vendor.categories || []).map((c) => c.toLowerCase()));
    const closedNew = chosen.filter((n) => !current.has(n.toLowerCase()) && !byLower.get(n.toLowerCase()).isActive);
    if (closedNew.length) {
      return res.status(400).json({ error: `Kundi hili halipokei biashara mpya kwa sasa: ${closedNew.join(', ')}. Wasiliana na Sipiki.` });
    }

    for (const name of chosen) {
      const slug = slugify(name) || `kundi-${Buffer.from(name).toString('hex').slice(0, 8)}`;
      await prisma.category.upsert({ where: { slug }, update: {}, create: { name, slug } });
    }
    const chosenLower = new Set(chosen.map((n) => n.toLowerCase()));
    const removed = (vendor.categories || []).filter((c) => !chosenLower.has(c.toLowerCase()));
    const productsInRemoved = removed.length
      ? await prisma.product.count({ where: { vendorId: vendor.id, deletedAt: null, category: { name: { in: removed } } } })
      : 0;

    await prisma.vendor.update({ where: { id: vendor.id }, data: { categories: chosen } });
    console.info(`[audit] vendor ${vendor.id} changed own categories: [${(vendor.categories || []).join(', ')}] -> [${chosen.join(', ')}]`);
    res.json({ categories: chosen, productsInRemoved });
  } catch (err) {
    console.error('updateMyCategories error:', err);
    res.status(500).json({ error: 'Imeshindikana kubadilisha makundi' });
  }
}

module.exports = {
  getMe, getSummary, getMyCategories, updateMyCategories, listMyProducts,
  createProduct, updateProduct, deleteProduct,
  handleImageUpload, addImage, deleteImage,
};
