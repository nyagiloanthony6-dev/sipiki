// ============================================================================
// Rate limiters — slow down brute-force logins and registration spam.
// Behind a proxy (Vercel, nginx, Render) set `app.set('trust proxy', 1)` in
// server.js so the limiter sees the real client IP, not the proxy's.
// ============================================================================
const rateLimit = require('express-rate-limit');

const make = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });

module.exports = {
  // 10 login attempts per 15 minutes per IP
  loginLimiter: make(15, 10, 'Majaribio mengi sana. Jaribu tena baada ya dakika 15.'),
  // 5 registrations per hour per IP (vendor applications upload files, so they're heavier)
  registerLimiter: make(60, 5, 'Maombi mengi sana kutoka kwenye mtandao huu. Jaribu tena baadaye.'),
};
