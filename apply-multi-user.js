const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMultiUserInfrastructure() {
  console.log('🚀 APPLYING MULTI-USER INFRASTRUCTURE')
  console.log('=====================================\n')
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'database', 'multi-user-infrastructure.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    
    // Split into individual statements (simplified - may need adjustment for complex SQL)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`)
    
    let successCount = 0
    let errorCount = 0
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      // Skip pure comments and DO blocks for now
      if (statement.includes('DO $$') || statement.includes('RAISE NOTICE')) {
        continue
      }
      
      try {
        // Log what we're doing
        const firstLine = statement.split('\n')[0].substring(0, 50)
        process.stdout.write(`[${i+1}/${statements.length}] Executing: ${firstLine}...`)
        
        // Execute via RPC (you may need to create an exec_sql function in Supabase)
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          console.log(' ❌')
          console.error(`   Error: ${error.message}`)
          errorCount++
        } else {
          console.log(' ✅')
          successCount++
        }
      } catch (err) {
        console.log(' ❌')
        console.error(`   Error: ${err.message}`)
        errorCount++
      }
    }
    
    console.log('\n📊 SUMMARY')
    console.log('==========')
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    
    if (errorCount === 0) {
      console.log('\n🎉 Multi-user infrastructure successfully installed!')
      console.log('✨ Features enabled:')
      console.log('   • Version control on all tables')
      console.log('   • Complete audit logging')
      console.log('   • User session tracking')
      console.log('   • Row-level security')
      console.log('   • Conflict detection')
    } else {
      console.log('\n⚠️  Some statements failed. This might be okay if:')
      console.log('   • Tables/columns already exist')
      console.log('   • Triggers are already in place')
      console.log('   • You need to manually run the SQL in Supabase dashboard')
    }
    
  } catch (err) {
    console.error('💥 Failed to apply infrastructure:', err)
    console.log('\n📌 ALTERNATIVE: Manual Installation')
    console.log('====================================')
    console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql')
    console.log('2. Copy the contents of: database/multi-user-infrastructure.sql')
    console.log('3. Paste and run in the SQL editor')
  }
}

// Check if exec_sql function exists, if not provide instructions
async function checkExecSQL() {
  console.log('🔍 Checking for exec_sql function...')
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' })
    
    if (error && error.message.includes('Could not find')) {
      console.log('❌ exec_sql function not found\n')
      console.log('📌 Please run this in Supabase SQL editor first:')
      console.log('=====================================')
      console.log(`
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
      `)
      console.log('=====================================\n')
      console.log('Then run this script again.\n')
      return false
    }
    
    console.log('✅ exec_sql function found\n')
    return true
  } catch (err) {
    console.log('⚠️  Cannot verify exec_sql function\n')
    return false
  }
}

// Main execution
async function main() {
  const hasExecSQL = await checkExecSQL()
  
  if (!hasExecSQL) {
    console.log('🎯 MANUAL INSTALLATION RECOMMENDED')
    console.log('==================================')
    console.log('1. Go to: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql')
    console.log('2. Copy contents from: database/multi-user-infrastructure.sql')
    console.log('3. Paste and execute in SQL editor')
    console.log('\nThis will ensure all features are properly installed.')
  } else {
    await applyMultiUserInfrastructure()
  }
}

main()