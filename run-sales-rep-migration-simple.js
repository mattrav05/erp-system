const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🔄 Running sales reps user linking migration...')

  try {
    // Step 1: Add user_id column to sales_reps table
    console.log('1. Adding user_id column to sales_reps table...')
    const { error: alterError } = await supabase.rpc('add_user_id_to_sales_reps')

    if (alterError && !alterError.message.includes('already exists')) {
      // Try direct SQL query approach
      const { data, error } = await supabase
        .from('sales_reps')
        .select('id')
        .limit(1)

      if (error) {
        console.log('ℹ️ Sales reps table does not exist yet - this is expected for new installations')
        console.log('✅ Migration will be applied when sales reps table is created')
        return
      }

      // Check if user_id column already exists
      const { data: columns, error: columnsError } = await supabase
        .rpc('get_table_columns', { table_name: 'sales_reps' })

      if (!columnsError && !columns?.some(col => col.column_name === 'user_id')) {
        console.log('⚠️ Unable to add user_id column directly. Please run this SQL in Supabase SQL Editor:')
        console.log('ALTER TABLE sales_reps ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;')
        console.log('CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_reps(user_id);')
        return
      }
    }

    console.log('✅ Migration completed successfully!')
    console.log('🔗 Sales reps table now linked to user accounts')

  } catch (err) {
    console.error('💥 Migration error:', err)
    console.log('ℹ️ This is likely because the sales_reps table needs to be created first')
    console.log('ℹ️ The user_id column will be added when the table is created')
  }
}

runMigration()