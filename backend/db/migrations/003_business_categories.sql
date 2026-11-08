-- ============================================================================
-- Business categories — the list vendors choose from when they register.
-- Admins switch categories on/off from the admin page (is_active), so only the
-- kinds of business you want to review are open for registration.
-- Names are stored as text on vendors.categories, so a category is never renamed
-- or deleted — only switched off.
-- ============================================================================
CREATE TABLE business_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(80) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_business_categories_name ON business_categories (lower(name));

INSERT INTO business_categories (name, sort_order) VALUES
    ('Mavazi', 1),
    ('Simu na Vifaa', 2),
    ('Viatu', 3),
    ('Urembo', 4),
    ('Mikoba na Vifaa', 5);
