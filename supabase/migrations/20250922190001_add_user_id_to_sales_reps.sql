-- Add user_id column to sales_reps table for linking to user accounts
ALTER TABLE sales_reps
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_reps(user_id);

-- Add comment explaining the column
COMMENT ON COLUMN sales_reps.user_id IS 'Links sales rep to user account for login and permissions';