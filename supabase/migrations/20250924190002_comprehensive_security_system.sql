-- Comprehensive Security & Permissions System for ERP
-- Integrates with existing user profiles and sales reps structure

-- Permission categories for granular control
CREATE TYPE permission_category AS ENUM (
  'sales',           -- estimates, orders, customers
  'inventory',       -- products, stock, adjustments
  'purchasing',      -- purchase orders, vendors
  'accounting',      -- invoices, payments, financial reports
  'shipping',        -- shipping/receiving operations
  'administration',  -- user management, system settings
  'reports'         -- analytics, reporting access
);

-- Permission actions
CREATE TYPE permission_action AS ENUM (
  'create',         -- Create new records
  'read',           -- View/read records
  'update',         -- Modify existing records
  'delete',         -- Delete records
  'approve',        -- Approve pending items
  'export',         -- Export/print documents
  'manage_users',   -- User management
  'view_costs',     -- See cost prices vs sell prices
  'unlimited_discounts', -- Apply any discount amount
  'view_all_territories' -- See data from all territories
);

-- Data scope levels
CREATE TYPE data_scope AS ENUM (
  'own',           -- Only own records (sales rep sees their customers)
  'territory',     -- Territory/department level
  'department',    -- Department level (all sales, all inventory, etc)
  'company'        -- All company data
);

-- Role-based permissions matrix
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  category permission_category NOT NULL,
  action permission_action NOT NULL,
  scope data_scope NOT NULL DEFAULT 'own',
  is_allowed BOOLEAN DEFAULT true,
  approval_limit DECIMAL(15,2), -- For purchase orders, discounts, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(role, category, action)
);

-- User-specific permission overrides (for custom permissions)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category permission_category NOT NULL,
  action permission_action NOT NULL,
  scope data_scope NOT NULL DEFAULT 'own',
  is_allowed BOOLEAN DEFAULT true,
  approval_limit DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  notes TEXT,

  UNIQUE(user_id, category, action)
);

-- Territory/department assignments for data scoping
CREATE TABLE IF NOT EXISTS user_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  territory_name TEXT NOT NULL,
  department TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, territory_name)
);

-- User session tracking for audit purposes
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMPTZ DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  session_duration INTERVAL,
  actions_performed INTEGER DEFAULT 0
);

-- Security audit log for permission-related events
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  permission_checked permission_category,
  permission_action permission_action,
  was_allowed BOOLEAN,
  denial_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default role permissions - Sales Rep role
INSERT INTO role_permissions (role, category, action, scope, is_allowed, approval_limit) VALUES
-- Sales reps can manage their own sales data
('sales_rep', 'sales', 'create', 'own', true, null),
('sales_rep', 'sales', 'read', 'own', true, null),
('sales_rep', 'sales', 'update', 'own', true, null),
('sales_rep', 'sales', 'export', 'own', true, null),
-- Can read products for estimates/orders but limited updates
('sales_rep', 'inventory', 'read', 'company', true, null),
-- Can create purchase orders (for ordering inventory) up to limit
('sales_rep', 'purchasing', 'create', 'own', true, 5000.00),
('sales_rep', 'purchasing', 'read', 'own', true, null),
('sales_rep', 'purchasing', 'update', 'own', true, null),
-- Limited discount authority
('sales_rep', 'sales', 'unlimited_discounts', 'own', false, null),
-- Cannot see cost prices by default
('sales_rep', 'inventory', 'view_costs', 'company', false, null),
-- Cannot delete by default
('sales_rep', 'sales', 'delete', 'own', false, null),
('sales_rep', 'purchasing', 'delete', 'own', false, null)

ON CONFLICT (role, category, action) DO NOTHING;

-- Sales Manager permissions
INSERT INTO role_permissions (role, category, action, scope, is_allowed, approval_limit) VALUES
-- Sales managers see all sales data in their territory/department
('sales_manager', 'sales', 'create', 'department', true, null),
('sales_manager', 'sales', 'read', 'department', true, null),
('sales_manager', 'sales', 'update', 'department', true, null),
('sales_manager', 'sales', 'delete', 'department', true, null),
('sales_manager', 'sales', 'approve', 'department', true, null),
('sales_manager', 'sales', 'export', 'department', true, null),
-- Can see cost information
('sales_manager', 'inventory', 'view_costs', 'company', true, null),
('sales_manager', 'inventory', 'read', 'company', true, null),
-- Higher purchase authority
('sales_manager', 'purchasing', 'create', 'department', true, 25000.00),
('sales_manager', 'purchasing', 'read', 'department', true, null),
('sales_manager', 'purchasing', 'update', 'department', true, null),
('sales_manager', 'purchasing', 'approve', 'department', true, null),
-- Unlimited discounts
('sales_manager', 'sales', 'unlimited_discounts', 'department', true, null),
-- Basic reports access
('sales_manager', 'reports', 'read', 'department', true, null),
('sales_manager', 'reports', 'export', 'department', true, null)

ON CONFLICT (role, category, action) DO NOTHING;

-- Inventory Manager permissions
INSERT INTO role_permissions (role, category, action, scope, is_allowed, approval_limit) VALUES
('inventory_manager', 'inventory', 'create', 'company', true, null),
('inventory_manager', 'inventory', 'read', 'company', true, null),
('inventory_manager', 'inventory', 'update', 'company', true, null),
('inventory_manager', 'inventory', 'delete', 'company', true, null),
('inventory_manager', 'inventory', 'view_costs', 'company', true, null),
-- Full purchasing authority
('inventory_manager', 'purchasing', 'create', 'company', true, 100000.00),
('inventory_manager', 'purchasing', 'read', 'company', true, null),
('inventory_manager', 'purchasing', 'update', 'company', true, null),
('inventory_manager', 'purchasing', 'approve', 'company', true, null),
('inventory_manager', 'purchasing', 'delete', 'company', true, null),
-- Shipping operations
('inventory_manager', 'shipping', 'create', 'company', true, null),
('inventory_manager', 'shipping', 'read', 'company', true, null),
('inventory_manager', 'shipping', 'update', 'company', true, null),
-- Read-only sales access
('inventory_manager', 'sales', 'read', 'company', true, null),
-- Inventory reports
('inventory_manager', 'reports', 'read', 'company', true, null),
('inventory_manager', 'reports', 'export', 'company', true, null)

ON CONFLICT (role, category, action) DO NOTHING;

-- Accountant permissions
INSERT INTO role_permissions (role, category, action, scope, is_allowed, approval_limit) VALUES
-- Full accounting access
('accountant', 'accounting', 'create', 'company', true, null),
('accountant', 'accounting', 'read', 'company', true, null),
('accountant', 'accounting', 'update', 'company', true, null),
('accountant', 'accounting', 'delete', 'company', true, null),
('accountant', 'accounting', 'export', 'company', true, null),
-- Can see all costs and financial data
('accountant', 'inventory', 'view_costs', 'company', true, null),
('accountant', 'sales', 'read', 'company', true, null),
('accountant', 'purchasing', 'read', 'company', true, null),
('accountant', 'inventory', 'read', 'company', true, null),
('accountant', 'shipping', 'read', 'company', true, null),
-- Full reports access
('accountant', 'reports', 'read', 'company', true, null),
('accountant', 'reports', 'export', 'company', true, null),
('accountant', 'reports', 'create', 'company', true, null)

ON CONFLICT (role, category, action) DO NOTHING;

-- Admin permissions (full access to everything)
INSERT INTO role_permissions (role, category, action, scope, is_allowed, approval_limit) VALUES
('admin', 'sales', 'create', 'company', true, null),
('admin', 'sales', 'read', 'company', true, null),
('admin', 'sales', 'update', 'company', true, null),
('admin', 'sales', 'delete', 'company', true, null),
('admin', 'sales', 'approve', 'company', true, null),
('admin', 'sales', 'export', 'company', true, null),
('admin', 'sales', 'unlimited_discounts', 'company', true, null),
('admin', 'inventory', 'create', 'company', true, null),
('admin', 'inventory', 'read', 'company', true, null),
('admin', 'inventory', 'update', 'company', true, null),
('admin', 'inventory', 'delete', 'company', true, null),
('admin', 'inventory', 'view_costs', 'company', true, null),
('admin', 'purchasing', 'create', 'company', true, null),
('admin', 'purchasing', 'read', 'company', true, null),
('admin', 'purchasing', 'update', 'company', true, null),
('admin', 'purchasing', 'delete', 'company', true, null),
('admin', 'purchasing', 'approve', 'company', true, null),
('admin', 'accounting', 'create', 'company', true, null),
('admin', 'accounting', 'read', 'company', true, null),
('admin', 'accounting', 'update', 'company', true, null),
('admin', 'accounting', 'delete', 'company', true, null),
('admin', 'shipping', 'create', 'company', true, null),
('admin', 'shipping', 'read', 'company', true, null),
('admin', 'shipping', 'update', 'company', true, null),
('admin', 'shipping', 'delete', 'company', true, null),
('admin', 'reports', 'create', 'company', true, null),
('admin', 'reports', 'read', 'company', true, null),
('admin', 'reports', 'update', 'company', true, null),
('admin', 'reports', 'delete', 'company', true, null),
('admin', 'reports', 'export', 'company', true, null),
('admin', 'administration', 'manage_users', 'company', true, null)

ON CONFLICT (role, category, action) DO NOTHING;

-- Viewer role (read-only)
INSERT INTO role_permissions (role, category, action, scope, is_allowed, approval_limit) VALUES
('viewer', 'sales', 'read', 'company', true, null),
('viewer', 'inventory', 'read', 'company', true, null),
('viewer', 'purchasing', 'read', 'company', true, null),
('viewer', 'accounting', 'read', 'company', true, null),
('viewer', 'shipping', 'read', 'company', true, null),
('viewer', 'reports', 'read', 'company', true, null),
-- Cannot see costs
('viewer', 'inventory', 'view_costs', 'company', false, null)

ON CONFLICT (role, category, action) DO NOTHING;

-- Helper function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_category permission_category,
  p_action permission_action,
  p_resource_owner_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  user_role_val user_role;
  permission_record RECORD;
  override_record RECORD;
  user_sales_rep_id UUID;
  is_sales_rep BOOLEAN := false;
BEGIN
  -- Get user's role
  SELECT role INTO user_role_val FROM profiles WHERE id = p_user_id;

  -- Check if user is a sales rep
  SELECT sr.id INTO user_sales_rep_id
  FROM sales_reps sr
  WHERE sr.user_id = p_user_id AND sr.is_active = true;

  IF user_sales_rep_id IS NOT NULL THEN
    is_sales_rep := true;
  END IF;

  -- Check for user-specific overrides first
  SELECT * INTO override_record
  FROM user_permission_overrides
  WHERE user_id = p_user_id
    AND category = p_category
    AND action = p_action;

  IF FOUND THEN
    -- Apply scope checking for overrides
    IF override_record.scope = 'own' AND p_resource_owner_id IS NOT NULL THEN
      IF is_sales_rep THEN
        -- For sales reps, check if they own the resource through sales_rep assignment
        RETURN p_resource_owner_id = user_sales_rep_id OR p_resource_owner_id = p_user_id;
      ELSE
        RETURN p_resource_owner_id = p_user_id;
      END IF;
    ELSE
      RETURN override_record.is_allowed;
    END IF;
  END IF;

  -- Check role-based permissions
  SELECT * INTO permission_record
  FROM role_permissions
  WHERE role = user_role_val
    AND category = p_category
    AND action = p_action;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Apply scope checking
  IF permission_record.scope = 'own' AND p_resource_owner_id IS NOT NULL THEN
    IF is_sales_rep THEN
      -- For sales reps, check if they own the resource through sales_rep assignment
      RETURN p_resource_owner_id = user_sales_rep_id OR p_resource_owner_id = p_user_id;
    ELSE
      RETURN p_resource_owner_id = p_user_id;
    END IF;
  END IF;

  RETURN permission_record.is_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security audit events
CREATE OR REPLACE FUNCTION log_security_audit(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_category permission_category,
  p_permission_action permission_action,
  p_was_allowed BOOLEAN,
  p_denial_reason TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO security_audit_log (
    user_id, action, resource_type, resource_id,
    permission_checked, permission_action, was_allowed,
    denial_reason, created_at
  ) VALUES (
    p_user_id, p_action, p_resource_type, p_resource_id,
    p_category, p_permission_action, p_was_allowed,
    p_denial_reason, NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_category ON role_permissions(role, category);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_category ON user_permission_overrides(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_territories_user_id ON user_territories(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_created ON security_audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_login ON user_sessions(user_id, login_time);

-- Enable RLS on new tables
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security tables (admin/manager access only)
CREATE POLICY "Admin can manage role permissions" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin can manage user permission overrides" ON user_permission_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can view own territories" ON user_territories
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin can manage territories" ON user_territories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin can view audit logs" ON security_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Comments for documentation
COMMENT ON TABLE role_permissions IS 'Defines what actions each role can perform on different categories of data';
COMMENT ON TABLE user_permission_overrides IS 'User-specific permission overrides that take precedence over role permissions';
COMMENT ON TABLE user_territories IS 'Territory/department assignments for data scoping';
COMMENT ON FUNCTION check_user_permission IS 'Central function to check if a user has permission to perform an action';
COMMENT ON FUNCTION log_security_audit IS 'Logs security-related events for auditing purposes';