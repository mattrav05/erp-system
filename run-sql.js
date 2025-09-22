const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd3poa2Vxd3ltcXJsamFhZGV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMzMzYzNiwiZXhwIjoyMDY5OTA5NjM2fQ.7aoVTB3jRRF2BRLL7nC3-UjF91igs15rdpcDYrc7Djg'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function executeSQLCommands() {
  console.log('🚀 Executing SQL commands...\n')

  const commands = [
    // 1. Add version control columns
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;`,
    `ALTER TABLE inventory ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;`,
    
    // 2. Add last_modified_by columns
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_modified_by UUID;`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS last_modified_by UUID;`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS last_modified_by UUID;`,
    `ALTER TABLE inventory ADD COLUMN IF NOT EXISTS last_modified_by UUID;`,
    
    // 3. Create profiles table
    `CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
      is_active BOOLEAN DEFAULT true,
      last_seen TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    
    // 4. Create audit_log table
    `CREATE TABLE IF NOT EXISTS audit_log (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id UUID NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
      old_values JSONB,
      new_values JSONB,
      changed_fields TEXT[],
      user_id UUID,
      user_email TEXT,
      ip_address INET,
      user_agent TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      version_before INTEGER,
      version_after INTEGER
    );`,
    
    // 5. Create user_sessions table
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID,
      table_name TEXT NOT NULL,
      record_id UUID NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('viewing', 'editing')),
      started_at TIMESTAMPTZ DEFAULT NOW(),
      last_ping TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb
    );`,
    
    // 6. Update existing records
    `UPDATE customers SET version = 1 WHERE version IS NULL;`,
    `UPDATE vendors SET version = 1 WHERE version IS NULL;`,
    `UPDATE products SET version = 1 WHERE products.version IS NULL;`,
    `UPDATE inventory SET version = 1 WHERE inventory.version IS NULL;`
  ]

  let success = 0
  let errors = 0

  for (let i = 0; i < commands.length; i++) {
    const sql = commands[i]
    const shortSql = sql.substring(0, 60) + (sql.length > 60 ? '...' : '')
    
    try {
      process.stdout.write(`[${i+1}/${commands.length}] ${shortSql} `)
      
      const { error } = await supabase.rpc('exec_sql', { sql })
      
      if (error) {
        console.log('❌')
        console.error(`   Error: ${error.message}`)
        errors++
      } else {
        console.log('✅')
        success++
      }
    } catch (err) {
      console.log('❌')
      console.error(`   Error: ${err.message}`)
      errors++
    }
  }
  
  console.log(`\n📊 Results: ✅ ${success} success, ❌ ${errors} errors`)
  
  if (errors > 0) {
    console.log('\n⚠️  Some commands failed - this might be normal if tables already exist')
  } else {
    console.log('\n🎉 All database updates completed successfully!')
  }
}

// First create the exec_sql function
async function createExecFunction() {
  console.log('Creating exec_sql function...')
  
  const { error } = await supabase.rpc('exec_sql', { 
    sql: `CREATE OR REPLACE FUNCTION exec_sql(sql text)
          RETURNS void AS $$
          BEGIN
            EXECUTE sql;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;` 
  })
  
  if (error && !error.message.includes('exec_sql')) {
    // Try direct execution
    const { error: directError } = await supabase
      .from('information_schema.routines')
      .select('*')
      .limit(1)
    
    if (!directError) {
      console.log('✅ Database connection working')
      return true
    }
  }
  
  return !error
}

async function main() {
  try {
    const hasExecSQL = await createExecFunction()
    if (hasExecSQL) {
      await executeSQLCommands()
    } else {
      console.log('❌ Could not create exec_sql function')
      console.log('Please run the multi-user SQL directly in Supabase dashboard')
    }
  } catch (err) {
    console.error('💥 Script failed:', err.message)
  }
}

main()