const express = require('express');
const router = express.Router();
const { handleUpload, registerVendor, listCategories } = require('../controllers/vendor.controller');
const portal = require('../controllers/vendorPortal.controller');
const orders = require('../controllers/order.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { registerLimiter, portalWriteLimiter } = require('../middleware/rateLimit.middleware');

// Reject malformed ids early with a clean 400 instead of a database error
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const badId = (res) => res.status(400).json({ error: 'Kitambulisho si sahihi' });
router.param('id', (req, res, next, id) => (UUID.test(id) ? next() : badId(res)));
router.param('orderId', (req, res, next, id) => (UUID.test(id) ? next() : badId(res)));
router.param('imageId', (req, res, next, id) => (UUID.test(id) ? next() : badId(res)));

// ---- public ---------------------------------------------------------------
// Categories currently open for registration (the form shows exactly these)
router.get('/categories', listCategories);

// Public business registration (multipart: text fields + idDoc, licenseDoc, tinDoc files).
// Rate limit first, so spam is rejected before any file is written to disk.
router.post('/register', registerLimiter, handleUpload, registerVendor);

// ---- vendor portal (signed-in vendors only) ---------------------------------
const vendorOnly = [authenticate, requireRole('vendor')];
router.get('/me', ...vendorOnly, portal.getMe);
router.get('/me/summary', ...vendorOnly, portal.getSummary);
router.get('/me/categories', ...vendorOnly, portal.getMyCategories);
router.get('/me/products', ...vendorOnly, portal.listMyProducts);
router.post('/me/products', ...vendorOnly, portalWriteLimiter, portal.createProduct);
router.patch('/me/products/:id', ...vendorOnly, portalWriteLimiter, portal.updateProduct);
router.delete('/me/products/:id', ...vendorOnly, portalWriteLimiter, portal.deleteProduct);
router.post('/me/products/:id/images', ...vendorOnly, portalWriteLimiter, portal.handleImageUpload, portal.addImage);
router.delete('/me/products/:id/images/:imageId', ...vendorOnly, portalWriteLimiter, portal.deleteImage);
router.get('/me/orders', ...vendorOnly, orders.listVendorOrders);
router.patch('/me/orders/:orderId/status', ...vendorOnly, portalWriteLimiter, orders.updateVendorOrderStatus);

module.exports = router;
