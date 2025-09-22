-- ============================================
-- MULTI-USER INFRASTRUCTURE FOR ERP SYSTEM
-- ============================================

-- 1. ADD VERSION CONTROL TO ALL TABLES
-- =====================================

-- Add version columns for optimistic locking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add last_modified_by tracking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- 2. USER PROFILES WITH PROPER ROLES
-- ==================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AUDIT LOG FOR ALL CHANGES
-- ============================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  version_before INTEGER,
  version_after INTEGER
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time ON audit_log(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);

-- 4. ACTIVE SESSIONS TRACKING
-- ===========================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('viewing', 'editing')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(user_id, table_name, record_id, action)
);

-- Index for real-time lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_record ON user_sessions(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(last_ping) WHERE last_ping > NOW() - INTERVAL '5 minutes';

-- 5. AUTOMATIC VERSION INCREMENT TRIGGERS
-- =======================================

CREATE OR REPLACE FUNCTION increment_version_and_audit()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  current_user_email TEXT;
  changed_fields TEXT[] := '{}';
  field_name TEXT;
BEGIN
  -- Get current user info
  current_user_id := auth.uid();
  SELECT email INTO current_user_email FROM auth.users WHERE id = current_user_id;
  
  -- For UPDATE operations, increment version and track changes
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := NOW();
    NEW.last_modified_by := current_user_id;
    
    -- Identify changed fields
    FOR field_name IN SELECT column_name FROM information_schema.columns 
                       WHERE table_name = TG_TABLE_NAME AND table_schema = TG_TABLE_SCHEMA
                       AND column_name NOT IN ('version', 'updated_at', 'last_modified_by')
    LOOP
      IF row_to_json(OLD)->>field_name IS DISTINCT FROM row_to_json(NEW)->>field_name THEN
        changed_fields := array_append(changed_fields, field_name);
      END IF;
    END LOOP;
    
    -- Log to audit table
    INSERT INTO audit_log (
      table_name, record_id, action, old_values, new_values, changed_fields,
      user_id, user_email, timestamp, version_before, version_after
    ) VALUES (
      TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), changed_fields,
      current_user_id, current_user_email, NOW(), OLD.version, NEW.version
    );
    
    RETURN NEW;
  END IF;
  
  -- For INSERT operations
  IF TG_OP = 'INSERT' THEN
    NEW.version := COALESCE(NEW.version, 1);
    NEW.created_at := COALESCE(NEW.created_at, NOW());
    NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    NEW.last_modified_by := current_user_id;
    
    INSERT INTO audit_log (
      table_name, record_id, action, new_values,
      user_id, user_email, timestamp, version_after
    ) VALUES (
      TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW),
      current_user_id, current_user_email, NOW(), NEW.version
    );
    
    RETURN NEW;
  END IF;
  
  -- For DELETE operations
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (
      table_name, record_id, action, old_values,
      user_id, user_email, timestamp, version_before
    ) VALUES (
      TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD),
      current_user_id, current_user_email, NOW(), OLD.version
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers to all main tables
DROP TRIGGER IF EXISTS customers_version_audit ON customers;
CREATE TRIGGER customers_version_audit
  BEFORE INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION increment_version_and_audit();

DROP TRIGGER IF EXISTS vendors_version_audit ON vendors;
CREATE TRIGGER vendors_version_audit
  BEFORE INSERT OR UPDATE OR DELETE ON vendors
  FOR EACH ROW EXECUTE FUNCTION increment_version_and_audit();

DROP TRIGGER IF EXISTS products_version_audit ON products;
CREATE TRIGGER products_version_audit
  BEFORE INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION increment_version_and_audit();

DROP TRIGGER IF EXISTS inventory_version_audit ON inventory;
CREATE TRIGGER inventory_version_audit
  BEFORE INSERT OR UPDATE OR DELETE ON inventory
  FOR EACH ROW EXECUTE FUNCTION increment_version_and_audit();

-- 6. SESSION CLEANUP FUNCTION
-- ===========================

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions 
  WHERE last_ping < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- 7. ROW LEVEL SECURITY SETUP
-- ===========================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can see all, but only update their own
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Audit log: read-only for all authenticated users
CREATE POLICY "Users can view audit log" ON audit_log FOR SELECT USING (auth.role() = 'authenticated');

-- User sessions: users can manage their own sessions
CREATE POLICY "Users can manage own sessions" ON user_sessions 
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view active sessions" ON user_sessions 
  FOR SELECT USING (last_ping > NOW() - INTERVAL '5 minutes');

-- 8. UTILITY FUNCTIONS
-- ====================

-- Get active users on a record
CREATE OR REPLACE FUNCTION get_active_users_on_record(table_name TEXT, record_id UUID)
RETURNS TABLE(user_id UUID, email TEXT, first_name TEXT, action TEXT, started_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT us.user_id, p.email, p.first_name, us.action, us.started_at
  FROM user_sessions us
  JOIN profiles p ON p.id = us.user_id
  WHERE us.table_name = $1 
    AND us.record_id = $2
    AND us.last_ping > NOW() - INTERVAL '5 minutes'
  ORDER BY us.started_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get record history
CREATE OR REPLACE FUNCTION get_record_history(table_name TEXT, record_id UUID, limit_count INTEGER DEFAULT 50)
RETURNS TABLE(
  id UUID, action TEXT, changed_fields TEXT[], user_email TEXT, 
  timestamp TIMESTAMPTZ, old_values JSONB, new_values JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT al.id, al.action, al.changed_fields, al.user_email, al.timestamp, al.old_values, al.new_values
  FROM audit_log al
  WHERE al.table_name = $1 AND al.record_id = $2
  ORDER BY al.timestamp DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. INITIALIZE EXISTING DATA
-- ===========================

-- Set version = 1 for existing records
UPDATE customers SET version = 1 WHERE version IS NULL;
UPDATE vendors SET version = 1 WHERE version IS NULL;
UPDATE products SET version = 1 WHERE version IS NULL;
UPDATE inventory SET version = 1 WHERE version IS NULL;

COMMENT ON TABLE audit_log IS 'Complete audit trail for all table changes';
COMMENT ON TABLE user_sessions IS 'Track active user sessions for collaboration';
COMMENT ON FUNCTION increment_version_and_audit() IS 'Automatically handles versioning and audit logging';
COMMENT ON FUNCTION get_active_users_on_record(TEXT, UUID) IS 'Get list of users currently working on a record';

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '✅ Multi-user infrastructure successfully installed!';
  RAISE NOTICE '📊 Features enabled: Version control, Audit logging, Session tracking, Row-level security';
END $$;