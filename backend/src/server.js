// ============================================================================
// App entrypoint
// ============================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Fail fast at startup rather than at the first login/upload if config is missing
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'FIELD_ENCRYPTION_KEY', 'FRONTEND_URL'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters');
  process.exit(1);
}

const authRoutes = require('./routes/auth.routes');
const vendorRoutes = require('./routes/vendor.routes');
const adminRoutes = require('./routes/admin.routes');
const productRoutes = require('./routes/product.routes');
const cartRoutes = require('./routes/cart.routes');
// const orderRoutes = require('./routes/order.routes');
// const webhookRoutes = require('./routes/webhook.routes'); // must use express.raw() for payment-provider signature verification

const app = express();

// Behind a proxy (Vercel / Render / nginx) the rate limiter needs the real client IP
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

// NOTE: payment webhook routes must be mounted BEFORE express.json() with
// express.raw({ type: 'application/json' }) so the raw body is available
// for signature verification.
// app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);   // public registration + vendor's own status
app.use('/api/admin', adminRoutes);      // admin-only (token + DB-verified role)
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
// app.use('/api/orders', orderRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Centralized error handler (catches anything not already handled)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
