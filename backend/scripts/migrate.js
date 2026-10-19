// ============================================================================
// Database migrations — applies every file in db/migrations/ (in filename order)
// to DATABASE_URL, each exactly once. Runs automatically before the API starts
// (see "start" in package.json) and can be run by hand: `npm run db:setup`.
//
//  - Applied files are recorded in the schema_migrations table, so re-running is safe.
//  - Each file runs in its own transaction: a failure leaves the database unchanged.
//  - An advisory lock stops two instances from migrating at the same moment.
//  - An applied file must never be edited afterwards (its checksum is verified).
//    To change the schema, add a new numbered file, e.g. 003_add_something.sql.
// ============================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');
const LOCK_ID = 7272001; // arbitrary constant shared by every instance of this app

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 20_000 });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        checksum   TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query('SELECT name, checksum FROM schema_migrations');
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    let ran = 0;
    for (const file of files) {
      // Normalise line endings so a Windows checkout can't change the checksum
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8').replace(/\r\n/g, '\n');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      if (applied.has(file)) {
        if (applied.get(file) !== checksum) {
          throw new Error(
            `${file} was changed after it was applied. Never edit an applied migration — add a new numbered file instead.`
          );
        }
        continue;
      }

      console.log(`[db] applying ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql); // no parameters → simple protocol → multi-statement files are fine
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${file} failed: ${err.message}`);
      }
      ran += 1;
    }

    console.log(ran ? `[db] applied ${ran} migration(s)` : '[db] database is up to date');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db] migration error:', err.message);
  process.exit(1); // a failed migration must stop the deploy, not start an API on a half-built database
});
