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

## The admin page
Open `/admin` on your website and sign in with the admin account from step 5. Admins can review applications
(including the uploaded documents), approve, reject (with a reason), suspend and reactivate vendors — each action
texts the vendor. The sign-in lasts 2 hours, then you are asked to sign in again. The page shows real data only;
it needs `NEXT_PUBLIC_API_URL` to be set (see step 3).

## The vendor portal
Approved businesses sign in at `/vendor` with the email and password they registered with. What they see depends on their status:
waiting for review, rejected (with the reason), suspended (with the reason), or — once approved — a dashboard where they can
add, edit, hide and delete products with up to 4 photos each. Products appear on the storefront right away. A vendor can only
list products in the categories they registered under. Photos are stored on the same Railway Volume as the documents
(`/data/product-images`, public) so nothing extra needs setting up. The approval SMS links to `/vendor` using `APP_URL` —
set `APP_URL` to your real website address (the Vercel address until `sipiki.co.tz` is connected).

**Product photos.** On upload the server (using `sharp`) turns the photo the right way up, removes hidden camera data (GPS
location, phone model), and saves three WebP copies: 1280 px (zoom), 800 px (product page) and 400 px (shop cards).
`GET /api/media/<key>?w=400|800` returns a smaller copy. The shop cards are square, and each product has a page at
`/product/<slug>` with a photo gallery, tap-to-zoom and share-preview tags for WhatsApp. The vendor form has a photo guide
and warns about small or dark photos. Photos uploaded before this change keep working (they have no small copies).

## Choosing which businesses can register
In `/admin`, open the **Makundi** tab. Each business category has an on/off switch: the registration form shows only
the categories that are switched on, and the server refuses applications for closed ones. You can add new categories
there too. Closing every category closes registration completely. Vendors who registered earlier are not affected.
(Each business category also gets a matching product category, so vendors can list products in it.)

## Not connected yet
- Orders: vendors see an empty Maagizo tab until customers can buy. Customer sign-up/checkout and mobile-money payments are not built (the payment code in `backend/src/services/stripe.service.js`
  is Stripe-based and does not cover M-Pesa / Tigo Pesa / Airtel Money).
- The admin vendor list loads the 100 most recent reviewed vendors; paging comes later.

## Local development
```bash
# database: any PostgreSQL 13+, then
cd backend  && cp .env.example .env && npm install && npm run db:setup && npm run dev   # http://localhost:4000
cd frontend && cp .env.example .env.local && npm install && npm run dev                 # http://localhost:3000
```


**Sellers changing their own categories.** In `/vendor` → Wasifu → "Makundi ya Biashara" an approved seller can add or remove
categories (`PATCH /api/vendors/me/categories`). They can **add only categories the admin has open**; a category they already
have can always be removed (even if the admin closed it later), and at least one must remain. Products already listed stay in
the shop; the seller just can't add new products under a removed category. Each change is written to the Railway log
(`[audit] vendor ... changed own categories`). The admin can still correct any business's categories from `/admin`.

## Customer orders (guest checkout)

Customers need **no account**. They add products to a cart (kept in the browser), then enter a **phone number and delivery
location** (region, area, optional name and note) and press "Tuma Oda". Payment is **on delivery** for now (cash or mobile
money paid to the seller) — `payment_method = 'on_delivery'`, so online payment can be added later without changing orders.

- `POST /api/orders` — places the order. Prices and stock are read from the database (never trusted from the browser); stock is
  taken in the same transaction with a conditional update, so two buyers can never get the last item. One order can contain
  several sellers' products; each seller only sees their own items. Order numbers look like `SPK-7K3M9Q`.
- `POST /api/orders/track` — the customer finds an order with the order number **and** the phone number used. Wrong either way
  gives the same "not found".
- `GET /api/vendors/me/orders`, `PATCH /api/vendors/me/orders/:orderId/status` — the seller's **Maagizo** tab: confirm
  → shipped → delivered, or cancel (stock goes back). The customer gets an SMS at each step.
- SMS (Beem) goes to the customer when the order is placed, to each seller about their new order, and to the customer on each
  status change. Set `SMS_PROVIDER=beem` and the Beem keys; otherwise messages are printed in the Railway log.
- `platform_fee_cents` is 0 for now — decide the commission before real payouts.
- Migration `005_guest_orders.sql` makes `orders.user_id` optional and adds order number, customer name/phone and payment method.

## More than one shop per owner

A seller can run several shops from one login. In the vendor portal, the shop name at the top opens a menu: **Maduka yangu** lists every shop with its status, and **Ongeza duka jipya** opens the add-shop form.

- The new shop reuses the owner's name, phone, NIDA, ID document and payout account, so none of that is typed or uploaded again.
- Each shop needs its own business name, location, categories, **TIN** and its own **licence and TIN certificate**. A TIN can only belong to one shop, so branches that share a TIN cannot be registered separately.
- A new shop goes through the same admin approval as the first one. The admin sees a note: "this owner has other shops".
- Products, orders, categories and the overview are separate for each shop. Orders and SMS texts go to the right shop.
- An owner can have up to 5 shops that are not rejected. The first shop must be approved before adding another.
- Database change: `006_multiple_shops.sql` runs on its own when the API starts. Look for `[db] applying 006_multiple_shops.sql` in the Railway log.

## Sizes, colours and product details

Before buying, a customer can see the details of a product and must choose the size or colour.

- **Sizes and colours:** in the product form the seller ticks "Bidhaa hii ina saizi au rangi tofauti" and lists each size/colour with its **own stock**. Shoes and clothes get quick size buttons (36–45, S–XXL); other categories can type any size or colour. The product's total stock is the sum of its sizes.
- **Customer side:** the product page shows size and colour buttons. A sold-out size is greyed out, the stock shown is for the chosen size, and the item cannot go into the cart until a size is chosen. In the shop list, such products show "Chagua" instead of the + button.
- **Orders:** the cart, the confirmation, order tracking and the seller's Maagizo tab all show the chosen option, for example "Saizi M · Nyeusi". Stock is taken from that size when the order is placed, and put back if the seller cancels.
- **Details table ("Maelezo ya bidhaa"):** the seller adds label/value rows (Brand, Material, Warranty, Fits model, ...). The form suggests fields to match the category (clothes, shoes, phones, beauty, bags, spare parts); the seller can add their own. Up to 20 rows.
- If the seller removes a size after it was ordered, that order still shows the size it was placed with.
- Database change: `007_product_details_variants.sql` runs on its own when the API starts. Look for `[db] applying 007_product_details_variants.sql` in the Railway log.
