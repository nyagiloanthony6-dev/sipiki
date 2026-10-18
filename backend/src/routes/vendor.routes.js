const express = require('express');
const router = express.Router();
const { handleUpload, registerVendor, getMyVendor } = require('../controllers/vendor.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { registerLimiter } = require('../middleware/rateLimit.middleware');

// Public business registration (multipart: text fields + idDoc, licenseDoc, tinDoc files).
// Rate limit first, so spam is rejected before any file is written to disk.
router.post('/register', registerLimiter, handleUpload, registerVendor);

// The logged-in vendor checks their own application status
router.get('/me', authenticate, requireRole('vendor'), getMyVendor);

module.exports = router;
