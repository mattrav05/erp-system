const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeDirectSQL() {
  console.log('🚀 Executing SQL migration directly...')

  try {
    // Use the admin function to execute raw SQL
    const { data, error } = await supabase.rpc('sql', {
      query: `
        -- Add user_id column to sales_reps table
        DO $$
        BEGIN
          -- Check if column already exists
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'sales_reps' AND column_name = 'user_id'
          ) THEN
            -- Add the column
            ALTER TABLE sales_reps
            ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

            -- Add index
            CREATE INDEX idx_sales_reps_user_id ON sales_reps(user_id);

            -- Add comment
            COMMENT ON COLUMN sales_reps.user_id IS 'Links sales rep to user account for login and permissions';

            RAISE NOTICE 'Migration completed successfully';
          ELSE
            RAISE NOTICE 'Column already exists';
          END IF;
        END $$;
      `
    })

    if (error) {
      console.error('❌ SQL execution failed:', error)
      return false
    }

    console.log('✅ SQL executed successfully')

    // Verify the migration worked
    const { error: testError } = await supabase
      .from('sales_reps')
      .select('user_id')
      .limit(1)

    if (!testError) {
      console.log('🎉 Migration verified! user_id column is now available')
      return true
    } else {
      console.log('❌ Migration verification failed:', testError.message)
      return false
    }

  } catch (error) {
    console.error('❌ Execution failed:', error.message)
    return false
  }
}

executeDirectSQL().then(success => {
  if (success) {
    console.log('\n🔄 Running data sync...')

    // Run the sync script
    const { spawn } = require('child_process')
    const sync = spawn('node', ['run-sales-rep-migration.js'], {
      stdio: 'inherit',
      env: { ...process.env }
    })

    sync.on('close', (code) => {
      console.log(`\n🎉 Migration and sync completed with code ${code}`)
    })
  } else {
    console.log('\n⚠️  SQL execution failed - using alternative method')
  }
})