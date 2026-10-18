-- ============================================================================
-- MULTI-VENDOR E-COMMERCE PLATFORM — POSTGRESQL SCHEMA
-- ============================================================================
-- Notes:
--  - UUIDs are used as primary keys (safer for public-facing APIs, easy sharding)
--  - Money is stored as INTEGER cents (avoids floating point rounding errors)
--  - Soft-delete via `deleted_at` is used on customer-facing entities
--  - All tables have created_at / updated_at for auditing
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('customer', 'vendor', 'admin');
CREATE TYPE vendor_status    AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE order_status     AS ENUM ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status   AS ENUM ('requires_payment', 'succeeded', 'failed', 'refunded', 'partially_refunded');
CREATE TYPE payout_status    AS ENUM ('pending', 'in_transit', 'paid', 'failed');

-- ----------------------------------------------------------------------------
-- USERS  (customers, vendors, admins share one identity table)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,       -- bcrypt/argon2 hash, never plaintext
    full_name       VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'customer',
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- VENDORS  (1:1 extension of a user with role='vendor')
-- ----------------------------------------------------------------------------
CREATE TABLE vendors (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    store_name              VARCHAR(255) NOT NULL,
    store_slug              VARCHAR(255) NOT NULL UNIQUE,
    store_description       TEXT,
    status                  vendor_status NOT NULL DEFAULT 'pending',
    -- Stripe Connect (Express/Standard) account id, e.g. "acct_1Nx..."
    stripe_account_id       VARCHAR(255) UNIQUE,
    stripe_onboarding_done  BOOLEAN NOT NULL DEFAULT FALSE,
    commission_rate         NUMERIC(5,2) NOT NULL DEFAULT 10.00, -- platform fee %
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendors_status ON vendors(status);

-- ----------------------------------------------------------------------------
-- CATEGORIES (self-referencing for nested categories)
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    name        VARCHAR(150) NOT NULL,
    slug        VARCHAR(150) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- PRODUCTS
-- ----------------------------------------------------------------------------
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL UNIQUE,
    description     TEXT,
    price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    stock_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_products_vendor ON products(vendor_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE deleted_at IS NULL;

CREATE TABLE product_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    position    SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE tags (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name    VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE product_tags (
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- REVIEWS
-- ----------------------------------------------------------------------------
CREATE TABLE reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, user_id) -- one review per customer per product
);

-- ----------------------------------------------------------------------------
-- CART (persisted server-side so it survives across devices/sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE carts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, product_id) -- adding same product again just bumps quantity
);

-- ----------------------------------------------------------------------------
-- ORDERS  (one order can contain items from MULTIPLE vendors)
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    status              order_status NOT NULL DEFAULT 'pending',
    subtotal_cents      INTEGER NOT NULL,
    platform_fee_cents  INTEGER NOT NULL DEFAULT 0,
    total_cents         INTEGER NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    shipping_address    JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Order items are split per-vendor so each vendor's fulfillment + payout
-- can be tracked independently within a single customer order.
CREATE TABLE order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES products(id),
    vendor_id           UUID NOT NULL REFERENCES vendors(id),
    quantity            INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents    INTEGER NOT NULL,
    subtotal_cents      INTEGER NOT NULL,
    fulfillment_status  order_status NOT NULL DEFAULT 'pending' -- vendor-level status
);
CREATE INDEX idx_order_items_vendor ON order_items(vendor_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ----------------------------------------------------------------------------
-- TRANSACTIONS  (the Stripe payment record for a whole order)
-- ----------------------------------------------------------------------------
CREATE TABLE transactions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                    UUID NOT NULL REFERENCES orders(id),
    stripe_payment_intent_id    VARCHAR(255) NOT NULL UNIQUE,
    amount_cents                INTEGER NOT NULL,
    currency                    CHAR(3) NOT NULL DEFAULT 'USD',
    status                      payment_status NOT NULL DEFAULT 'requires_payment',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-vendor payout derived from a transaction (Stripe Connect `Transfer`).
-- This is where the "split payment" logic settles: platform takes its
-- commission_rate cut, remainder goes to the vendor's connected account.
CREATE TABLE vendor_payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id),
    order_id            UUID NOT NULL REFERENCES orders(id),
    transaction_id      UUID NOT NULL REFERENCES transactions(id),
    gross_amount_cents  INTEGER NOT NULL, -- vendor's items subtotal
    platform_fee_cents  INTEGER NOT NULL, -- commission withheld
    net_amount_cents    INTEGER NOT NULL, -- gross - fee = what vendor receives
    stripe_transfer_id  VARCHAR(255) UNIQUE,
    status              payout_status NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_vendor ON vendor_payouts(vendor_id);
CREATE INDEX idx_payouts_status ON vendor_payouts(status);
