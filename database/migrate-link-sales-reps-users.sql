-- Migration: Link Sales Reps to User Accounts
-- This creates a connection between the sales_reps table and user profiles

-- Add user_id field to sales_reps table
ALTER TABLE sales_reps
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_reps(user_id);

-- Add comment
COMMENT ON COLUMN sales_reps.user_id IS 'Links sales rep to user account for login and permissions';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Sales reps linked to user accounts successfully!';
  RAISE NOTICE '🔗 Sales reps can now be connected to user profiles for integrated access';
END $$;