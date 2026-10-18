// ============================================================================
// Auth Controller — customer registration, login (all roles), current user
//
// Vendors register through POST /api/vendors/register (needs documents), and
// admins are created only by `npm run create-admin` — there is deliberately no
// public endpoint that can create an admin or accept a role from the client.
// ============================================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { loginSchema, customerRegistrationSchema } = require('../validators/vendor.validators');

const BCRYPT_ROUNDS = 12;
// Compared against when the email doesn't exist, so "unknown email" and "wrong
// password" take the same time and give the same answer (prevents account enumeration).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

function signToken(user) {
  // Admin tokens are short-lived: a stolen admin token is far more damaging.
  const expiresIn = user.role === 'admin' ? '2h' : '7d';
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn });
}

function publicUser(user, vendor) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    // Lets the frontend show "your application is under review" to vendors
    vendor: vendor ? { id: vendor.id, storeName: vendor.storeName, status: vendor.status } : null,
  };
}

/** POST /api/auth/register — customer accounts only */
async function registerCustomer(req, res) {
  const parsed = customerRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Taarifa si sahihi', details: parsed.error.flatten().fieldErrors });
  }
  const { fullName, email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Barua pepe hii tayari imesajiliwa' });

    const user = await prisma.user.create({
      data: { fullName, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), role: 'customer' },
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user, null) });
  } catch (err) {
    console.error('registerCustomer error:', err);
    res.status(500).json({ error: 'Imeshindikana kusajili akaunti' });
  }
}

/** POST /api/auth/login — works for customers, vendors and admins */
async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Barua pepe au nenosiri si sahihi' });
  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email }, include: { vendor: true } });
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || user.deletedAt || !passwordOk) {
      return res.status(401).json({ error: 'Barua pepe au nenosiri si sahihi' }); // same message for every failure
    }

    res.json({ token: signToken(user), user: publicUser(user, user.vendor) });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Imeshindikana kuingia' });
  }
}

/** GET /api/auth/me — who am I (re-reads the DB, so role/status changes show up immediately) */
async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { vendor: true } });
    if (!user || user.deletedAt) return res.status(401).json({ error: 'Akaunti haipatikani' });
    res.json({ user: publicUser(user, user.vendor) });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'Imeshindikana kupata taarifa' });
  }
}

module.exports = { registerCustomer, login, me, BCRYPT_ROUNDS };
