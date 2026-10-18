// ============================================================================
// Cart Controller
// Server-persisted cart (survives login across devices). Every authenticated
// user has exactly one Cart row; CartItems reference products with quantity.
// ============================================================================
const prisma = require('../config/db');

// Helper: fetch (or lazily create) the cart for the current user, with items
async function getOrCreateCart(userId) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              priceCents: true,
              currency: true,
              stockQuantity: true,
              images: { take: 1, orderBy: { position: 'asc' } },
              vendor: { select: { id: true, storeName: true } },
            },
          },
        },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: { items: true },
    });
  }
  return cart;
}

// Shapes the cart response and computes the running total for the client
function serializeCart(cart) {
  const items = cart.items.map((item) => ({
    id: item.id,
    productId: item.product.id,
    title: item.product.title,
    slug: item.product.slug,
    thumbnail: item.product.images[0]?.url ?? null,
    unitPriceCents: item.product.priceCents,
    quantity: item.quantity,
    lineTotalCents: item.product.priceCents * item.quantity,
    vendor: item.product.vendor,
    availableStock: item.product.stockQuantity,
  }));

  const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);

  return { id: cart.id, items, subtotalCents, itemCount: items.reduce((s, i) => s + i.quantity, 0) };
}

/**
 * GET /api/cart
 * Returns the current user's cart with computed totals.
 */
async function getCart(req, res) {
  try {
    const cart = await getOrCreateCart(req.user.id);
    res.json(serializeCart(cart));
  } catch (err) {
    console.error('getCart error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
}

/**
 * POST /api/cart/items
 * Body: { productId, quantity }
 * Adds a product to the cart. If it's already present, quantity is incremented
 * rather than duplicated (enforced by the unique [cartId, productId] index).
 */
async function addItem(req, res) {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId || quantity < 1) {
      return res.status(400).json({ error: 'productId and a positive quantity are required' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Product not found or unavailable' });
    }
    if (product.stockQuantity < quantity) {
      return res.status(409).json({ error: 'Insufficient stock', available: product.stockQuantity });
    }

    const cart = await getOrCreateCart(req.user.id);

    // Upsert: if the product is already in the cart, increment; else insert.
    const existing = cart.items.find((i) => i.productId === productId);
    if (existing) {
      const newQuantity = existing.quantity + quantity;
      if (newQuantity > product.stockQuantity) {
        return res.status(409).json({ error: 'Insufficient stock for requested quantity' });
      }
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }

    const updatedCart = await getOrCreateCart(req.user.id);
    res.status(200).json(serializeCart(updatedCart));
  } catch (err) {
    console.error('addItem error:', err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
}

/**
 * PATCH /api/cart/items/:itemId
 * Body: { quantity }
 * Updates the quantity of an existing cart line. Setting quantity to 0
 * is equivalent to removing the item.
 */
async function updateItemQuantity(req, res) {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true, product: true },
    });

    // Ownership check: users may only modify their own cart
    if (!cartItem || cartItem.cart.userId !== req.user.id) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      if (quantity > cartItem.product.stockQuantity) {
        return res.status(409).json({ error: 'Insufficient stock', available: cartItem.product.stockQuantity });
      }
      await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }

    const updatedCart = await getOrCreateCart(req.user.id);
    res.json(serializeCart(updatedCart));
  } catch (err) {
    console.error('updateItemQuantity error:', err);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
}

/**
 * DELETE /api/cart/items/:itemId
 * Removes a single line item from the cart entirely.
 */
async function removeItem(req, res) {
  try {
    const { itemId } = req.params;

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!cartItem || cartItem.cart.userId !== req.user.id) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    const updatedCart = await getOrCreateCart(req.user.id);
    res.json(serializeCart(updatedCart));
  } catch (err) {
    console.error('removeItem error:', err);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
}

/**
 * DELETE /api/cart
 * Empties the entire cart (e.g. after a successful checkout).
 */
async function clearCart(req, res) {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    res.status(204).send();
  } catch (err) {
    console.error('clearCart error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
}

module.exports = { getCart, addItem, updateItemQuantity, removeItem, clearCart };
