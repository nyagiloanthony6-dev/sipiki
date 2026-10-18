const express = require('express');
const router = express.Router();
const { registerCustomer, login, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit.middleware');

router.post('/register', registerLimiter, registerCustomer); // customers only — vendors use /api/vendors/register
router.post('/login', loginLimiter, login);                  // customers, vendors and admins
router.get('/me', authenticate, me);

module.exports = router;
