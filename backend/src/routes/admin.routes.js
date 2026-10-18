// ============================================================================
// Admin routes — every route below requires a valid token AND an admin role
// that is re-verified against the database (see requireAdmin).
// ============================================================================
const express = require('express');
const router = express.Router();
const admin = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');

router.use(authenticate, requireAdmin);

// Reject malformed ids early with a clean 400 instead of a database error
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('id', (req, res, next, id) => (UUID.test(id) ? next() : res.status(400).json({ error: 'Kitambulisho si sahihi' })));
router.param('docId', (req, res, next, id) => (UUID.test(id) ? next() : res.status(400).json({ error: 'Kitambulisho si sahihi' })));

router.get('/stats', admin.getStats);
router.get('/applications', admin.listApplications);
router.get('/vendors', admin.listVendors);
router.get('/vendors/:id', admin.getVendor);
router.get('/vendors/:id/documents/:docId', admin.downloadDocument);

router.post('/vendors/:id/approve', admin.approveVendor);
router.post('/vendors/:id/reject', admin.rejectVendor);
router.post('/vendors/:id/suspend', admin.suspendVendor);
router.post('/vendors/:id/reactivate', admin.reactivateVendor);

module.exports = router;
