const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyMigration() {
  console.log('🔍 Verifying migration status...')

  try {
    // Test if user_id column exists
    const { data, error } = await supabase
      .from('sales_reps')
      .select('user_id')
      .limit(1)

    if (!error) {
      console.log('✅ Migration successful! user_id column is available')
      console.log('🚀 You can now run: node run-sales-rep-migration.js')
      return true
    } else {
      console.log('❌ Migration not yet applied')
      console.log('📋 Please run the SQL in MIGRATION_SQL.sql file')
      console.log('🔗 Go to: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new')
      return false
    }
  } catch (error) {
    console.error('Error:', error.message)
    return false
  }
}

verifyMigration()