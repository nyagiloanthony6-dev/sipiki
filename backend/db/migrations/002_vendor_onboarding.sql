-- ============================================================================
-- 002 — VENDOR ONBOARDING (business registration + admin approval)
-- Applied automatically after 001_initial_schema.sql (see scripts/migrate.js). Adds the business/owner/payout fields collected by
-- the registration wizard, document storage, a status audit trail, and an SMS log.
-- ============================================================================

CREATE TYPE document_type AS ENUM ('owner_id', 'business_license', 'tin_certificate');

-- ----------------------------------------------------------------------------
-- VENDORS — business, owner and Mobile Money payout details
-- ----------------------------------------------------------------------------
ALTER TABLE vendors
    ADD COLUMN application_ref        VARCHAR(20)  UNIQUE,           -- e.g. SPK-2026-4821, shown to the applicant
    ADD COLUMN business_type          VARCHAR(40),                   -- Mtu Binafsi | Kampuni (Ltd) | Ushirika / Kikundi
    ADD COLUMN region                 VARCHAR(60),
    ADD COLUMN location               VARCHAR(255),
    ADD COLUMN categories             TEXT[]       NOT NULL DEFAULT '{}',
    ADD COLUMN owner_phone            VARCHAR(15),                   -- normalised: 255712345678
    ADD COLUMN tin                    VARCHAR(11)  UNIQUE,           -- 123-456-789 (one business per TIN)
    ADD COLUMN nida_number_encrypted  TEXT,                          -- AES-256-GCM, see backend/src/utils/crypto.js
    ADD COLUMN payout_provider        VARCHAR(20),                   -- M-Pesa | Tigo Pesa | Airtel Money | HaloPesa
    ADD COLUMN payout_phone           VARCHAR(15),                   -- normalised: 255712345678
    ADD COLUMN payout_account_name    VARCHAR(255),
    ADD COLUMN rejection_reason       TEXT,
    ADD COLUMN suspension_reason      TEXT,
    ADD COLUMN reviewed_by            UUID REFERENCES users(id),     -- admin who last changed the status
    ADD COLUMN reviewed_at            TIMESTAMPTZ;

CREATE INDEX idx_vendors_region ON vendors(region);

-- ----------------------------------------------------------------------------
-- VENDOR DOCUMENTS — uploaded verification files (stored privately, never public)
-- ----------------------------------------------------------------------------
CREATE TABLE vendor_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id     UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    type          document_type NOT NULL,
    original_name VARCHAR(255) NOT NULL,   -- what the user called it (display only)
    storage_key   VARCHAR(255) NOT NULL,   -- random server-generated filename; the ONLY path ever used on disk
    mime_type     VARCHAR(100) NOT NULL,
    size_bytes    INTEGER NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vendor_id, type)               -- one file per document type
);

-- ----------------------------------------------------------------------------
-- VENDOR STATUS HISTORY — who changed what, when, and why (admin audit trail)
-- ----------------------------------------------------------------------------
CREATE TABLE vendor_status_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id   UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    from_status vendor_status,             -- NULL for the initial 'pending' row
    to_status   vendor_status NOT NULL,
    reason      TEXT,
    changed_by  UUID REFERENCES users(id), -- NULL when the applicant registered themselves
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendor_history_vendor ON vendor_status_history(vendor_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- SMS LOG — every notification attempt (approval, rejection, suspension...)
-- ----------------------------------------------------------------------------
CREATE TABLE sms_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id   UUID REFERENCES vendors(id) ON DELETE SET NULL,
    to_phone    VARCHAR(15) NOT NULL,
    template    VARCHAR(40) NOT NULL,      -- application_received | approved | rejected | suspended | reactivated
    message     TEXT NOT NULL,
    provider    VARCHAR(20) NOT NULL,      -- beem | console
    success     BOOLEAN NOT NULL,
    provider_response TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_logs_vendor ON sms_logs(vendor_id);
