// ============================================================================
// Role-based access control (RBAC) middleware
// ============================================================================
const prisma = require('../config/db');

// Usage: router.post('/products', authenticate, requireRole('vendor'), handler)
// Fast check against the role stored in the JWT. Fine for low-risk routes.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

// Admin routes use this stricter check instead. A JWT stays valid until it
// expires, so a token issued to someone who was later demoted or deleted would
// otherwise keep working. Here the role is re-read from the database on every
// admin request, so revoking admin access takes effect immediately.
async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, role: true, deletedAt: true },
    });
    if (!user || user.deletedAt || user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

module.exports = { requireRole, requireAdmin };
