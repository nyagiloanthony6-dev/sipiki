# Sipiki — Biashara Mkononi

Multi-vendor marketplace for Tanzania.

```
frontend/   Next.js 14 website (storefront, vendor registration, admin)  → hosted on Vercel
backend/    Express + Prisma API (accounts, vendor registration, admin approval, SMS)  → hosted on Railway
            backend/db/migrations/   PostgreSQL schema, applied automatically when the API starts
```

## Going live

Do the steps in this order — each address is needed by the next step.

### 1. Put the code on GitHub
Push this repo to `main`. Both Vercel and Railway deploy from it, and from then on every push to `main`
redeploys both.

### 2. Railway — database and API
1. **New Project → Deploy PostgreSQL.** (Keep the service name `Postgres`.)
2. In the same project: **New → GitHub Repo →** this repo. Open the new service's **Settings** and set
   **Root Directory** to `/backend`.
3. **Add a Volume** to this service (right-click the service on the canvas, or the command palette) with mount
   path **`/data`**. Uploaded ID/licence/TIN documents are stored here. Without it the API refuses to start,
   because documents on the container's own disk would be erased at every deploy.
4. Service → **Variables**:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `JWT_SECRET` | 48+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
   | `FIELD_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — **keep a copy in a password manager**; without it stored NIDA numbers cannot be read |
   | `FRONTEND_URL` | the website address(es), no trailing slash, comma-separated — use any placeholder now, set the real one in step 4 |
   | `APP_URL` | `https://sipiki.co.tz` (used inside SMS texts) |

5. **Settings → Networking → Generate Domain.** Open `https://<that-domain>/health` — it should show `{"status":"ok"}`.
   The database tables are created automatically on the first start (see the deploy logs: `[db] applying ...`).
6. Optional: under **Settings → Config as code**, set the file path to `/backend/railway.json` to enable the health check.

### 3. Vercel — the website
1. **Add New → Project →** this repo, **Root Directory: `frontend`**.
2. Environment variable: `NEXT_PUBLIC_API_URL` = `https://<your-railway-domain>/api` (must end in `/api`).
3. Deploy. If you change this variable later you must **redeploy** — it is baked in at build time.

### 4. Tell the API where the website is
Back in Railway, set `FRONTEND_URL` to the Vercel address (e.g. `https://sipiki.vercel.app`) — plus your own
domain later, separated by a comma. The API only accepts browser requests from these addresses.

### 5. Create the first admin
Admins can only be created from the command line — no web page can do it. From your computer:

```bash
cd backend && npm install
# Railway → Postgres service → Variables → copy DATABASE_PUBLIC_URL (the one reachable from outside Railway)
DATABASE_URL="<DATABASE_PUBLIC_URL>" npm run create-admin -- you@example.com "Your Name"
```
It asks for a password (12+ characters, typed hidden).

## Text messages (SMS)
Without `SMS_PROVIDER=beem` the API prints messages to its log instead of sending them. To send real texts, create a
Beem Africa account, register the sender name `SIPIKI`, and add `SMS_PROVIDER=beem`, `BEEM_API_KEY`,
`BEEM_SECRET_KEY`, `BEEM_SENDER_ID` in Railway. Check the request format in `backend/src/services/sms.service.js`
against Beem's current documentation first.

## Troubleshooting
- **"No Volume is attached"** in the logs → add the Volume (step 2.3).
- **"Permission denied" writing to `/data`** → add the variable `RAILWAY_RUN_UID=0` to the service.
- **Browser shows a CORS error** → `FRONTEND_URL` must match the website address exactly (`https://`, no trailing slash).
- **Registration form says "demo"/does nothing real** → `NEXT_PUBLIC_API_URL` is missing in Vercel, or you did not redeploy after adding it.
- **"Missing required environment variables"** → the log names the ones to add.
- **Database errors after editing a `.sql` file** → never edit a migration that was already applied; add a new numbered file in `backend/db/migrations/`.

## Not connected yet
- `/admin` still shows sample data and has no login — the API for it exists (`/api/admin/...`), the page is not wired to it.
  Until then treat `/admin` as a demo only.
- Customer sign-up/checkout and mobile-money payments are not built (the payment code in `backend/src/services/stripe.service.js`
  is Stripe-based and does not cover M-Pesa / Tigo Pesa / Airtel Money).

## Local development
```bash
# database: any PostgreSQL 13+, then
cd backend  && cp .env.example .env && npm install && npm run db:setup && npm run dev   # http://localhost:4000
cd frontend && cp .env.example .env.local && npm install && npm run dev                 # http://localhost:3000
```
