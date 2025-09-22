const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd3poa2Vxd3ltcXJsamFhZGV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMzMzYzNiwiZXhwIjoyMDY5OTA5NjM2fQ.7aoVTB3jRRF2BRLL7nC3-UjF91igs15rdpcDYrc7Djg'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testConnection() {
  console.log('🔍 Testing database connection...')
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .limit(1)
    
    if (!error) {
      console.log('✅ Database connection successful')
      console.log(`Found customers table with records`)
      
      // Check if version column exists
      const { data: columns, error: colError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'customers')
        .eq('column_name', 'version')
      
      if (!colError && columns && columns.length > 0) {
        console.log('✅ Version column already exists')
      } else {
        console.log('⚠️  Version column needs to be added')
      }
      
      return true
    } else {
      console.log('❌ Database connection failed:', error.message)
      return false
    }
  } catch (err) {
    console.log('❌ Connection test failed:', err.message)
    return false
  }
}

async function addVersionColumns() {
  console.log('\n🔧 Adding version columns...')
  
  const alterCommands = [
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1',
    'ALTER TABLE vendors ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1', 
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1',
    'ALTER TABLE inventory ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1'
  ]
  
  for (const sql of alterCommands) {
    try {
      // Try using direct SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ sql })
      })
      
      if (response.ok) {
        console.log('✅', sql.substring(0, 50) + '...')
      } else {
        console.log('⚠️ ', sql.substring(0, 50) + '...', await response.text())
      }
    } catch (err) {
      console.log('❌', sql.substring(0, 50) + '...', err.message)
    }
  }
}

async function testVersionColumns() {
  console.log('\n🧪 Testing version columns...')
  
  const tables = ['customers', 'vendors', 'products', 'inventory']
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('version')
        .limit(1)
      
      if (!error) {
        console.log(`✅ ${table}: version column working`)
      } else {
        console.log(`❌ ${table}: ${error.message}`)
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`)
    }
  }
}

async function main() {
  const connected = await testConnection()
  if (connected) {
    await addVersionColumns()
    await testVersionColumns()
  }
}

main()