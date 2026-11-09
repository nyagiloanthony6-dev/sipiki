-- One owner (login) can run several shops. Each shop is its own vendors row with its own
-- approval, TIN, licence, categories and products; the owner's details are copied when a shop is added.
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_user_id_key;
CREATE INDEX IF NOT EXISTS idx_vendors_user ON vendors(user_id);
