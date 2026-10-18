// ============================================================================
// Creates (or promotes) an admin account. Admins can ONLY be created this way —
// no HTTP endpoint accepts a role — so access to the server is required.
//
// Usage:
//   npm run create-admin -- admin@sipiki.co.tz "Full Name"
// The password is read from the ADMIN_PASSWORD env var or prompted for, so it
// never appears in shell history or process listings.
// ============================================================================
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); }; // hide typed characters
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

(async () => {
  const [email, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(' ').trim();
  if (!email || !fullName || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error('Usage: npm run create-admin -- <email> "<Full Name>"');
    process.exit(1);
  }

  const password = process.env.ADMIN_PASSWORD || (await promptHidden('Admin password (min 12 chars): '));
  if (password.length < 12) {
    console.error('Admin password must be at least 12 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { role: 'admin', passwordHash, fullName, deletedAt: null },
    create: { email: normalizedEmail, role: 'admin', passwordHash, fullName, emailVerified: true },
  });
  console.log(`Admin ready: ${user.email} (${user.id})`);
})()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
