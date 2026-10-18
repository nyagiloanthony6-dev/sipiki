// ============================================================================
// Product Controller
// Handles public product catalog listing/detail, and vendor-side CRUD.
// ============================================================================
const prisma = require('../config/db');

/**
 * GET /api/products
 * Public catalog listing with pagination, category/tag filtering, and search.
 * Query params: page, limit, category, tag, search, minPrice, maxPrice
 */
async function listProducts(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      tag,
      search,
      minPrice,
      maxPrice,
    } = req.query;

    const take = Math.min(Number(limit), 100); // hard cap to prevent abuse
    const skip = (Number(page) - 1) * take;

    // Build the WHERE clause dynamically based on which filters were supplied
    const where = {
      isActive: true,
      deletedAt: null,
      vendor: { status: 'active' }, // suspended/rejected vendors' products disappear from the shop
      ...(category && { category: { slug: category } }),
      ...(tag && { tags: { some: { tag: { name: tag } } } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(minPrice || maxPrice
        ? {
            priceCents: {
              ...(minPrice && { gte: Number(minPrice) * 100 }),
              ...(maxPrice && { lte: Number(maxPrice) * 100 }),
            },
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { orderBy: { position: 'asc' }, take: 1 }, // thumbnail only
          category: { select: { name: true, slug: true } },
          vendor: { select: { storeName: true, storeSlug: true } },
          tags: { include: { tag: { select: { name: true } } } },
          _count: { select: { reviews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Flatten tag/review shape for a cleaner API response
    const data = products.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      priceCents: p.priceCents,
      currency: p.currency,
      thumbnail: p.images[0]?.url ?? null,
      category: p.category,
      vendor: p.vendor,
      tags: p.tags.map((t) => t.tag.name),
      reviewCount: p._count.reviews,
      inStock: p.stockQuantity > 0,
    }));

    res.json({
      data,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error('listProducts error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

/**
 * GET /api/products/:slug
 * Full product detail including reviews and average rating.
 */
async function getProductBySlug(req, res) {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findFirst({
      where: { slug, isActive: true, deletedAt: null, vendor: { status: 'active' } },
      include: {
        images: { orderBy: { position: 'asc' } },
        category: true,
        vendor: { select: { storeName: true, storeSlug: true, id: true } },
        tags: { include: { tag: true } },
        reviews: {
          include: { user: { select: { fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const avgRating =
      product.reviews.length > 0
        ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
        : null;

    res.json({ ...product, averageRating: avgRating });
  } catch (err) {
    console.error('getProductBySlug error:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
}

/**
 * POST /api/vendor/products
 * Vendor creates a new product listing. Requires role='vendor'.
 */
async function createProduct(req, res) {
  try {
    const { title, slug, description, priceCents, currency, stockQuantity, categoryId, tags = [] } = req.body;

    // req.user.id is the authenticated user; resolve their vendor record
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) return res.status(403).json({ error: 'No vendor profile found for this account' });

    // Only approved vendors may list products (pending applicants, rejected and suspended vendors cannot)
    if (vendor.status !== 'active') {
      return res.status(403).json({ error: 'Akaunti yako haijaidhinishwa bado', status: vendor.status });
    }

    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        title,
        slug,
        description,
        priceCents,
        currency: currency || 'USD',
        stockQuantity: stockQuantity ?? 0,
        categoryId,
        tags: {
          create: tags.map((tagName) => ({
            tag: {
              connectOrCreate: { where: { name: tagName }, create: { name: tagName } },
            },
          })),
        },
      },
      include: { tags: { include: { tag: true } } },
    });

    res.status(201).json(product);
  } catch (err) {
    console.error('createProduct error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

module.exports = { listProducts, getProductBySlug, createProduct };
