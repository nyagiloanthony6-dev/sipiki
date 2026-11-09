// ============================================================================
// Which shop is this request for?
// One owner login can run several shops. The portal sends the chosen shop in the
// "X-Shop-Id" header. We only ever accept a shop that belongs to the signed-in user;
// with no header we use their first approved shop (or, failing that, their oldest).
// ============================================================================
const prisma = require('../config/db');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** All shops of the signed-in owner, oldest first. */
function ownerShops(userId) {
  return prisma.vendor.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

/**
 * Returns { vendor, shops }.
 * vendor is null when the owner has no shop, or asked for a shop that is not theirs
 * (then `missing` is true so the caller can tell the browser to forget its choice).
 */
async function resolveShop(req) {
  const shops = await ownerShops(req.user.id);
  if (shops.length === 0) return { vendor: null, shops, missing: false };
  const wanted = req.get('x-shop-id');
  if (wanted) {
    const vendor = UUID.test(wanted) ? shops.find((s) => s.id.toLowerCase() === wanted.toLowerCase()) : null;
    return vendor ? { vendor, shops, missing: false } : { vendor: null, shops, missing: true };
  }
  return { vendor: shops.find((s) => s.status === 'active') || shops[0], shops, missing: false };
}

module.exports = { resolveShop, ownerShops };
