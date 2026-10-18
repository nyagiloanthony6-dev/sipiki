// ============================================================================
// Authentication middleware
// Verifies the JWT sent in the Authorization header and attaches the decoded
// user payload (id, role) to req.user for downstream handlers.
// ============================================================================
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization; // "Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.sub, role: decoded.role }; // sub = user id
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Allows a route to proceed even if there's no token (e.g. guest cart viewing)
// but still attaches req.user if a valid token IS present.
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    req.user = { id: decoded.sub, role: decoded.role };
  } catch (_) {
    // Invalid token on an optional route — just proceed as a guest
  }
  next();
}

module.exports = { authenticate, optionalAuthenticate };
