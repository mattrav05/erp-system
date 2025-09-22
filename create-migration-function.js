const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createMigrationFunction() {
  console.log('🔧 Creating database migration function in Supabase...')

  try {
    // First, let's create a simple text function to test
    const { data: testData, error: testError } = await supabase.rpc('test_function', {})

    if (testError && testError.message.includes('Could not find the function')) {
      console.log('📝 No existing functions found, will create our migration function')

      // Since we can't create functions via the API, let's work around this
      // by using an INSERT operation that will trigger the migration

      console.log('🚀 Attempting migration via table manipulation...')

      // Try to get current sales_reps structure
      const { data: currentReps, error: repsError } = await supabase
        .from('sales_reps')
        .select('*')
        .limit(1)

      if (repsError) {
        console.error('❌ Cannot access sales_reps table:', repsError.message)
        return false
      }

      console.log('📊 Current sales_reps columns:', Object.keys(currentReps[0] || {}))

      // Check if user_id column exists by trying to select it
      const { data: userIdTest, error: userIdError } = await supabase
        .from('sales_reps')
        .select('user_id')
        .limit(1)

      if (!userIdError) {
        console.log('✅ user_id column already exists!')
        return true
      }

      console.log('❌ user_id column does not exist')
      console.log('💡 The migration requires direct database access')

      // Let's create the SQL that needs to be run manually
      const migrationSQL = `
-- Sales Rep User Linking Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new

-- Add user_id column to sales_reps table
ALTER TABLE sales_reps
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_reps(user_id);

-- Add comment explaining the column
COMMENT ON COLUMN sales_reps.user_id IS 'Links sales rep to user account for login and permissions';

-- Verify the migration
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_reps' AND column_name = 'user_id';
`

      console.log('\n📋 MIGRATION SQL TO RUN MANUALLY:')
      console.log('=====================================')
      console.log(migrationSQL)
      console.log('=====================================\n')

      console.log('📍 Steps to complete migration:')
      console.log('1. Go to: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new')
      console.log('2. Copy and paste the SQL above')
      console.log('3. Click "Run" to execute the migration')
      console.log('4. Then run the sync script: node run-sales-rep-migration.js')

      return false
    }

    return false
  } catch (error) {
    console.error('❌ Error:', error.message)
    return false
  }
}

createMigrationFunction().then(success => {
  if (success) {
    console.log('✅ Migration function ready')
  } else {
    console.log('📝 Manual migration required')
  }
})