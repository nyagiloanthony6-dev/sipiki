// ============================================================================
// Prisma Client singleton
// Prevents exhausting DB connections from hot-reloading multiple instances
// ============================================================================
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = prisma;
