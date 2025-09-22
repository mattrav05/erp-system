const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  console.log('🔧 Applying sales rep migration...')

  try {
    // Create a function to apply the migration
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION add_user_id_to_sales_reps()
      RETURNS void AS $$
      BEGIN
        -- Add user_id column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sales_reps' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE sales_reps
          ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

          CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_reps(user_id);

          RAISE NOTICE 'Added user_id column to sales_reps table';
        ELSE
          RAISE NOTICE 'user_id column already exists';
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `

    // Execute the function creation
    const { error: functionError } = await supabase.rpc('exec', { sql: createFunctionSQL })

    if (functionError) {
      console.log('📝 Creating migration function via alternative method...')

      // Try direct column addition via update (this will fail but we can check the error)
      const { error: testError } = await supabase
        .from('sales_reps')
        .update({ user_id: null })
        .eq('id', 'non-existent-id')

      if (testError && testError.message.includes('column "user_id" does not exist')) {
        console.log('❌ Column does not exist and cannot be created via API')
        console.log('💡 Creating the migration manually using SQL...')

        // Let's try using the REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            sql: 'ALTER TABLE sales_reps ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;'
          })
        })

        if (response.ok) {
          console.log('✅ Migration applied successfully via REST API')
        } else {
          console.log('⚠️  Direct migration not available via API')
          console.log('The migration needs to be applied through the Supabase dashboard')
        }
      }
    } else {
      // Execute the migration function
      const { error: execError } = await supabase.rpc('add_user_id_to_sales_reps')

      if (execError) {
        console.log('Migration function error:', execError.message)
      } else {
        console.log('✅ Migration applied successfully')
      }
    }

    // Test if the column exists now
    const { error: testColumnError } = await supabase
      .from('sales_reps')
      .select('user_id')
      .limit(1)

    if (!testColumnError) {
      console.log('✅ user_id column is now available')
      return true
    } else {
      console.log('❌ user_id column still not available')
      return false
    }

  } catch (error) {
    console.error('Migration error:', error.message)
    return false
  }
}

applyMigration().then(success => {
  if (success) {
    console.log('🎉 Migration completed successfully!')
  } else {
    console.log('⚠️  Migration needs manual intervention')
  }
})