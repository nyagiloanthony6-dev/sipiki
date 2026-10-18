# Sipiki — Biashara Mkononi

Multi-vendor marketplace for Tanzania.

```
frontend/   Next.js 14 site (storefront, vendor registration, admin) → deployed on Vercel
backend/    Express + Prisma API (auth, vendor registration, admin approval, SMS) → host separately
database/   PostgreSQL schema + migrations
```

## Deploying the frontend (Vercel + GitHub)

1. Vercel → **Add New → Project** → import this GitHub repo.
2. **Root Directory: `frontend`** (the framework is detected as Next.js automatically).
3. Environment variable (optional until the API is hosted): `NEXT_PUBLIC_API_URL` = your API's public URL ending in `/api`.
   Without it the registration form runs in demo mode.
4. Deploy. From then on, every push to `main` redeploys production, and every pull request gets its own preview URL.

## The backend

The API stores uploaded verification documents on disk and runs as a long-lived Express server, so it does not fit
Vercel's serverless model as-is. Host it on Render / Railway / Fly.io (with a persistent disk), or move uploads to
object storage first. The settings it needs are listed in `backend/.env.example`; create the first admin with
`npm run create-admin` and apply `database/schema.sql` then `database/migrations/002_vendor_onboarding.sql`.

## Local development

```bash
cd frontend && npm install && npm run dev        # http://localhost:3000
cd backend  && npm install && npm run dev        # http://localhost:4000
```
