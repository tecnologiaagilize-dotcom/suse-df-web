-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) UNIQUE,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('operator', 'investor', 'auditor', 'regulator')),
    permissions JSONB DEFAULT '{}',
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Batches Table
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    waste_type VARCHAR(100) NOT NULL,
    quantity_kg DECIMAL(10,2) NOT NULL CHECK (quantity_kg > 0),
    source_location JSONB NOT NULL,
    collection_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'collected' CHECK (status IN ('collected', 'sorted', 'processed', 'tokenized')),
    metadata JSONB DEFAULT '{}',
    ipfs_hash VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_batch_id ON batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_user_id ON batches(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_waste_type ON batches(waste_type);

-- Token Events Table
CREATE TABLE IF NOT EXISTS token_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    batch_id UUID REFERENCES batches(id),
    token_type VARCHAR(10) NOT NULL CHECK (token_type IN ('VL', 'OI')),
    token_id DECIMAL(78,0) NOT NULL,
    amount DECIMAL(78,0) NOT NULL,
    from_address VARCHAR(42),
    to_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_events_tx_hash ON token_events(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_token_events_batch_id ON token_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_token_events_token_type ON token_events(token_type);

-- RLS Policies
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- Users can only see their own batches (unless auditor/regulator)
CREATE POLICY users_view_own_batches ON batches FOR SELECT
    USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('auditor', 'regulator')
        )
    );

-- Only authenticated users can create batches
CREATE POLICY authenticated_create_batches ON batches FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update only their own batches
CREATE POLICY users_update_own_batches ON batches FOR UPDATE
    USING (auth.uid() = user_id);
