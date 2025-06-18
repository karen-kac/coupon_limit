-- Supabase Database Schema for Coupon Limit App
-- Production-ready schema based on models.py

-- Enable Row Level Security
ALTER DATABASE postgres SET timezone TO 'Asia/Tokyo';

-- Create Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create Stores table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address VARCHAR(500),
    owner_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create spatial index for location-based queries
CREATE INDEX IF NOT EXISTS idx_stores_location ON stores(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_stores_owner_email ON stores(owner_email);

-- Create Coupons table
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    discount_rate_initial INTEGER NOT NULL,
    discount_rate_schedule JSONB,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    active_status VARCHAR(50) DEFAULT 'active',
    current_discount INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_active_status CHECK (active_status IN ('active', 'expired', 'exploded')),
    CONSTRAINT valid_discount_rates CHECK (discount_rate_initial >= 0 AND discount_rate_initial <= 100 AND current_discount >= 0 AND current_discount <= 100)
);

-- Create indexes for coupon queries
CREATE INDEX IF NOT EXISTS idx_coupons_store_id ON coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_active_status ON coupons(active_status);
CREATE INDEX IF NOT EXISTS idx_coupons_time_range ON coupons(start_time, end_time);

-- Create UserCoupons table (junction table)
CREATE TABLE IF NOT EXISTS user_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    obtained_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'obtained',
    discount_at_obtain INTEGER NOT NULL,
    
    CONSTRAINT valid_user_coupon_status CHECK (status IN ('obtained', 'used', 'expired')),
    CONSTRAINT valid_discount_at_obtain CHECK (discount_at_obtain >= 0 AND discount_at_obtain <= 100),
    UNIQUE(user_id, coupon_id)
);

-- Create indexes for user coupon queries
CREATE INDEX IF NOT EXISTS idx_user_coupons_user_id ON user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon_id ON user_coupons(coupon_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_status ON user_coupons(status);

-- Create Admins table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    linked_store_id UUID REFERENCES stores(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT valid_admin_role CHECK (role IN ('store_owner', 'super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);

-- Create GeoPoints table for location tracking
CREATE TABLE IF NOT EXISTS geo_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for geo queries
CREATE INDEX IF NOT EXISTS idx_geo_points_user_id ON geo_points(user_id);
CREATE INDEX IF NOT EXISTS idx_geo_points_timestamp ON geo_points(timestamp);
CREATE INDEX IF NOT EXISTS idx_geo_points_location ON geo_points(latitude, longitude);

-- Create Reservations table (future feature)
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    note TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_reservation_status CHECK (status IN ('pending', 'confirmed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_store_id ON reservations(store_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date_time ON reservations(date_time);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Public read access to active stores and coupons
CREATE POLICY "Public can view active stores" ON stores FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active coupons" ON coupons FOR SELECT USING (active_status = 'active');

-- Users can manage their own coupons
CREATE POLICY "Users can view own coupons" ON user_coupons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own coupons" ON user_coupons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own coupons" ON user_coupons FOR UPDATE USING (auth.uid() = user_id);

-- Store owners can manage their stores and coupons
CREATE POLICY "Store owners can manage their stores" ON stores FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM admins 
        WHERE admins.email = auth.jwt()->>'email' 
        AND admins.linked_store_id = stores.id 
        AND admins.role = 'store_owner'
        AND admins.is_active = true
    )
);

CREATE POLICY "Store owners can manage their coupons" ON coupons FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM stores 
        JOIN admins ON admins.linked_store_id = stores.id
        WHERE stores.id = coupons.store_id
        AND admins.email = auth.jwt()->>'email' 
        AND admins.role = 'store_owner'
        AND admins.is_active = true
    )
);

-- Super admins can manage everything
CREATE POLICY "Super admins can manage all data" ON stores FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM admins 
        WHERE admins.email = auth.jwt()->>'email' 
        AND admins.role = 'super_admin'
        AND admins.is_active = true
    )
);

-- Sample data for development/testing
INSERT INTO stores (name, description, latitude, longitude, address, owner_email) VALUES
('東京駅コーヒーショップ', '美味しいコーヒーとパンの店', 35.6812, 139.7671, '東京都千代田区丸の内1-1-1', 'coffee@example.com'),
('銀座レストラン', '本格的な和食レストラン', 35.6762, 139.7653, '東京都中央区銀座1-1-1', 'restaurant@example.com'),
('新宿書店', '本とカフェの複合店', 35.6896, 139.7006, '東京都新宿区新宿1-1-1', 'bookstore@example.com')
ON CONFLICT DO NOTHING;

-- Sample admin users
INSERT INTO admins (email, password_hash, role, linked_store_id) VALUES
('admin@couponlimit.com', '$2b$12$dummy-hash-for-super-admin', 'super_admin', NULL),
('coffee@example.com', '$2b$12$dummy-hash-for-store-owner', 'store_owner', (SELECT id FROM stores WHERE owner_email = 'coffee@example.com' LIMIT 1)),
('restaurant@example.com', '$2b$12$dummy-hash-for-store-owner', 'store_owner', (SELECT id FROM stores WHERE owner_email = 'restaurant@example.com' LIMIT 1)),
('bookstore@example.com', '$2b$12$dummy-hash-for-store-owner', 'store_owner', (SELECT id FROM stores WHERE owner_email = 'bookstore@example.com' LIMIT 1))
ON CONFLICT DO NOTHING;