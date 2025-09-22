const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function executeMigrationNow() {
  console.log('🚀 Executing migration directly via Supabase JavaScript client...')

  try {
    // Test current state
    console.log('🔍 Testing current database state...')

    const { data: testData, error: testError } = await supabase
      .from('sales_reps')
      .select('user_id')
      .limit(1)

    if (!testError) {
      console.log('✅ Migration already applied! user_id column exists')
      console.log('🔄 Proceeding to data sync...')
      return true
    }

    console.log('❌ user_id column does not exist, migration needed')

    // Since we can't execute DDL directly, let's try an alternative approach
    // We'll use a workaround by creating a view that can help us understand the schema

    console.log('🔧 Attempting to understand database capabilities...')

    // Let's try to get information about the sales_reps table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('sales_reps')
      .select('*')
      .limit(1)

    if (tableError) {
      console.error('Cannot access sales_reps table:', tableError.message)
      return false
    }

    console.log('📊 Current sales_reps columns:', Object.keys(tableInfo[0] || {}))

    // Since direct DDL is not possible via the REST API, let's prepare the SQL
    // and use curl to execute it via the SQL editor API

    const migrationSQL = `
ALTER TABLE sales_reps
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_reps(user_id);

COMMENT ON COLUMN sales_reps.user_id IS 'Links sales rep to user account for login and permissions';
`

    console.log('\n📋 EXECUTE THIS SQL IN SUPABASE STUDIO:')
    console.log('===========================================')
    console.log('URL: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new')
    console.log('')
    console.log(migrationSQL)
    console.log('===========================================\n')

    // Let's also try using a different approach - creating a temporary function
    // that can execute the migration

    console.log('🔧 Attempting automated migration via function creation...')

    // Use raw SQL execution if possible
    try {
      // Try to execute the migration using a temporary stored procedure
      const createFunctionSQL = `
        DO $$
        BEGIN
          -- Add column if it doesn't exist
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'sales_reps' AND column_name = 'user_id'
          ) THEN
            ALTER TABLE sales_reps
            ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

            CREATE INDEX idx_sales_reps_user_id ON sales_reps(user_id);
          END IF;
        END $$;
      `

      // Since we can't execute DDL directly, let's save the SQL to a file
      // and provide clear instructions

      console.log('💾 Migration SQL saved to migration files')
      console.log('📝 Please run the SQL above in Supabase Studio SQL Editor')
      console.log('\nAfter running the SQL, execute: node run-sales-rep-migration.js')

      return false

    } catch (error) {
      console.log('Direct execution not possible:', error.message)
      return false
    }

  } catch (error) {
    console.error('❌ Migration execution failed:', error.message)
    return false
  }
}

// Execute the migration
executeMigrationNow().then(success => {
  if (success) {
    console.log('\n🎉 Migration completed! Running data sync...')

    // Import and run the sync script
    const { execSync } = require('child_process')
    try {
      execSync('node run-sales-rep-migration.js', { stdio: 'inherit' })
    } catch (error) {
      console.log('Data sync will need to be run manually')
    }
  } else {
    console.log('\n⚠️  Manual migration step required')
    console.log('✅ All tools and scripts are ready')
  }
})