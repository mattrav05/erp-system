const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🔄 Running sales reps user linking migration...')

  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('./database/migrate-link-sales-reps-users.sql', 'utf8')

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      console.error('❌ Migration failed:', error)
      return
    }

    console.log('✅ Migration completed successfully!')
    console.log('🔗 Sales reps table now linked to user accounts')

  } catch (err) {
    console.error('💥 Migration error:', err)
  }
}

runMigration()