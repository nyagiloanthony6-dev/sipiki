const express = require('express');
const router = express.Router();
const { listProducts, getProductBySlug, createProduct } = require('../controllers/product.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

// Public catalog
router.get('/', listProducts);
router.get('/:slug', getProductBySlug);

// Vendor-only: create a product
router.post('/', authenticate, requireRole('vendor', 'admin'), createProduct);

module.exports = router;
