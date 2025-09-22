-- Sales Rep User Linking Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new

-- Add user_id column to sales_reps table
ALTER TABLE sales_reps
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_reps(user_id);

-- Add comment explaining the column
COMMENT ON COLUMN sales_reps.user_id IS 'Links sales rep to user account for login and permissions';

-- Verify the migration worked
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_reps' AND column_name = 'user_id';

-- Show success message
DO $$
BEGIN
  RAISE NOTICE '✅ Sales reps linked to user accounts successfully!';
  RAISE NOTICE '🔗 Sales reps can now be connected to user profiles for integrated access';
END $$;