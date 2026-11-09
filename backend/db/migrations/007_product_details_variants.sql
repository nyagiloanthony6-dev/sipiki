-- Product details before purchase:
--  * specs    — a list of {label, value} pairs shown on the product page (Brand, Material, Warranty, ...)
--  * product_variants — sizes / colours, each with its own stock (clothes, shoes, ...)
-- When a product has variants, products.stock_quantity is kept equal to the total of its variants.
ALTER TABLE products ADD COLUMN IF NOT EXISTS specs JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS product_variants (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id     UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size           VARCHAR(20) NOT NULL DEFAULT '',
    color          VARCHAR(30) NOT NULL DEFAULT '',
    stock_quantity INTEGER     NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    position       SMALLINT    NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, size, color)
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);

-- Which size/colour was ordered (the label is kept as written, even if the seller later changes the product)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id    UUID REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_label VARCHAR(80);
