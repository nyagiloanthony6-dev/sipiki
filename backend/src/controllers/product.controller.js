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

    const take = Math.min(Math.max(Number(limit) || 20, 1), 100); // hard cap to prevent abuse
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

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
          _count: { select: { reviews: true, variants: true } },
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
      description: p.description,
      inStock: p.stockQuantity > 0,
      hasOptions: p._count.variants > 0, // sizes/colours → the customer must choose on the product page
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
        variants: { orderBy: { position: 'asc' }, select: { id: true, size: true, color: true, stockQuantity: true } },
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
 * GET /api/products/categories
 * Categories that currently have at least one product on sale (what the storefront's category tiles show).
 */
async function listProductCategories(_req, res) {
  try {
    const rows = await prisma.category.findMany({
      where: { products: { some: { isActive: true, deletedAt: null, vendor: { status: 'active' } } } },
      orderBy: { name: 'asc' },
      select: { name: true, slug: true },
    });
    res.set('Cache-Control', 'no-store');
    res.json({ data: rows });
  } catch (err) {
    console.error('listProductCategories error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata makundi' });
  }
}

module.exports = { listProducts, getProductBySlug, listProductCategories };
