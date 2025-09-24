-- Add new user roles to existing enum
-- This needs to be in a separate transaction from using them

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales_rep';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'inventory_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'purchasing_agent';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';