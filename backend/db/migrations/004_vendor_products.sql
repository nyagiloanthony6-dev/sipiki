-- ============================================================================
-- Vendor products: product photos stored on the server volume, Tanzanian
-- shillings as the default currency, and product categories that match the
-- business categories vendors register under.
-- ============================================================================

-- Photos live as files on the volume; these columns say which file and its type.
-- (url stays: it holds the relative address the website uses, /api/media/<storage_key>)
ALTER TABLE product_images
    ADD COLUMN storage_key VARCHAR(48) UNIQUE,
    ADD COLUMN mime_type   VARCHAR(20);

ALTER TABLE products ALTER COLUMN currency SET DEFAULT 'TZS';

-- A vendor lists products in the categories they registered under, so every business
-- category needs a matching product category (same name).
INSERT INTO categories (name, slug)
SELECT name, trim(both '-' from lower(regexp_replace(name, '[^A-Za-z0-9]+', '-', 'g')))
FROM business_categories
ON CONFLICT (slug) DO NOTHING;
