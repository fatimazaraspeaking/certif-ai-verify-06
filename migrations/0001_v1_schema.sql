
-- Migration file: 0001_v1_schema.sql

-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    wallet_address TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificates table
CREATE TABLE certificates (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    program_name TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    verification_url TEXT NOT NULL,
    certificate_url TEXT NOT NULL,  -- R2 storage URL (PDF FORMAT)
    arweave_url TEXT,                     -- Permanent storage URL
    nft_mint_address TEXT,                -- Solana NFT address
    verification_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_details TEXT,            -- JSON containing verification details
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verification logs
CREATE TABLE verification_logs (
    id TEXT PRIMARY KEY,
    certificate_id TEXT REFERENCES certificates(id),
    verification_step TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);  

-- Add verification_url_pdf column to certificates table
ALTER TABLE certificates 
ADD COLUMN verification_url_pdf TEXT; -- R2 storage URL (PDF FORMAT)
