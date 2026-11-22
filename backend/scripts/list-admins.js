// ============================================================================
// Lists the admin accounts (email, name, when created, last change) so you can
// see who has admin access and which email to use when resetting a password.
// Never prints password hashes.
//
// Usage:
//   npm run list-admins
// ============================================================================
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, fullName: true, createdAt: true, updatedAt: true, deletedAt: true },
  });
  if (admins.length === 0) {
    console.log('No admin accounts yet. Create one with: npm run create-admin -- <email> "<Full Name>"');
    return;
  }
  console.log(`${admins.length} admin account${admins.length === 1 ? '' : 's'}:\n`);
  for (const a of admins) {
    const status = a.deletedAt ? 'DISABLED (deleted)' : 'active';
    console.log(`- ${a.email}  |  ${a.fullName}  |  ${status}`);
    console.log(`    created ${a.createdAt.toISOString().slice(0, 10)}, last changed ${a.updatedAt.toISOString().slice(0, 10)}, id ${a.id}`);
  }
})()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
