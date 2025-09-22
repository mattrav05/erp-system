const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function executeMigration() {
  console.log('🚀 Executing migration via SQL...')

  try {
    // First, let's create a simple function that can execute DDL
    const createHelperFunction = `
      CREATE OR REPLACE FUNCTION execute_migration()
      RETURNS text AS $$
      DECLARE
        result text;
      BEGIN
        -- Check if column exists
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sales_reps' AND column_name = 'user_id'
        ) THEN
          result := 'Column already exists';
        ELSE
          -- Add the column
          EXECUTE 'ALTER TABLE sales_reps ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL';
          EXECUTE 'CREATE INDEX idx_sales_reps_user_id ON sales_reps(user_id)';
          result := 'Column added successfully';
        END IF;

        RETURN result;
      END;
      $$ LANGUAGE plpgsql;
    `

    console.log('📝 Creating migration helper function...')

    // Use a different approach - execute SQL through a stored procedure
    const { data, error } = await supabase.rpc('sql', {
      query: createHelperFunction
    })

    if (error) {
      console.log('Function creation failed:', error.message)

      // Try alternative method using the REST API directly
      console.log('🔧 Trying direct SQL execution...')

      const sqlCommands = [
        'ALTER TABLE sales_reps ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;',
        'CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_reps(user_id);'
      ]

      for (const sql of sqlCommands) {
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({ query: sql })
          })

          if (response.ok) {
            console.log(`✅ Executed: ${sql}`)
          } else {
            const errorText = await response.text()
            console.log(`❌ Failed: ${sql} - ${errorText}`)
          }
        } catch (fetchError) {
          console.log(`Network error: ${fetchError.message}`)
        }
      }
    } else {
      console.log('✅ Helper function created, executing migration...')

      // Now execute the migration
      const { data: migrationResult, error: migrationError } = await supabase.rpc('execute_migration')

      if (migrationError) {
        console.log('Migration execution failed:', migrationError.message)
      } else {
        console.log('Migration result:', migrationResult)
      }
    }

    // Test if it worked
    console.log('🔍 Testing if migration was successful...')
    const { error: testError } = await supabase
      .from('sales_reps')
      .select('user_id')
      .limit(1)

    if (!testError) {
      console.log('🎉 Migration successful! user_id column is now available')
      return true
    } else {
      console.log('❌ Migration failed or column still not available')
      console.log('Error:', testError.message)
      return false
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    return false
  }
}

executeMigration()