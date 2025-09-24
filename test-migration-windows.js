const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Use the new API keys from .env.local
const supabaseUrl = 'https://tcwzhkeqwymqrljaadew.supabase.co'
const serviceRoleKey = 'sb_secret_WhuY5jf2DDI6pxm7UB98FQ_VRIyFfiy'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  try {
    console.log('Reading migration file...')
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250923191701_shipping_system.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('Applying migration via JavaScript client...')
    console.log('Migration size:', migrationSQL.length, 'characters')

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log('Found', statements.length, 'SQL statements to execute')

    let executed = 0
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          console.log(`Executing statement ${executed + 1}/${statements.length}...`)
          const { data, error } = await supabase.rpc('exec_sql', { sql: statement })

          if (error) {
            console.error('Error executing statement:', error)
            console.log('Statement was:', statement.substring(0, 100) + '...')
            break
          }

          executed++
        } catch (err) {
          console.error('Exception executing statement:', err)
          console.log('Statement was:', statement.substring(0, 100) + '...')
          break
        }
      }
    }

    console.log(`Successfully executed ${executed}/${statements.length} statements`)

    if (executed === statements.length) {
      console.log('✅ Migration applied successfully!')
    } else {
      console.log('❌ Migration partially applied')
    }

  } catch (error) {
    console.error('Migration failed:', error)
  }
}

// Test connection first
async function testConnection() {
  try {
    console.log('Testing Supabase connection...')
    const { data, error } = await supabase.from('products').select('count(*)', { count: 'exact', head: true })

    if (error) {
      console.error('Connection test failed:', error)
      return false
    }

    console.log('✅ Connection successful!')
    return true
  } catch (error) {
    console.error('Connection test exception:', error)
    return false
  }
}

async function main() {
  const connected = await testConnection()
  if (connected) {
    await applyMigration()
  }
}

main()