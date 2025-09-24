// Script to check the profiles table structure
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_WhuY5jf2DDI6pxm7UB98FQ_VRIyFfiy'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProfilesTable() {
  try {
    console.log('📋 Checking profiles table structure...\n')

    // Try to get one record to see what columns exist
    const { data: sample, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Error:', error)
      return
    }

    if (sample && sample.length > 0) {
      console.log('✅ Available columns in profiles table:')
      console.log(Object.keys(sample[0]).join(', '))
      console.log('\n📊 Sample record:')
      console.log(JSON.stringify(sample[0], null, 2))
    } else {
      console.log('❌ No data found in profiles table')
    }

    // Check all users with available columns
    console.log('\n👥 All users with available data:')
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    users?.forEach((user, index) => {
      console.log(`${index + 1}. ${user.first_name || 'N/A'} ${user.last_name || 'N/A'} (${user.email}) - Role: ${user.role}`)
    })

  } catch (error) {
    console.error('Check failed:', error)
  }
}

checkProfilesTable().then(() => {
  console.log('\n✅ Table structure check complete!')
  process.exit(0)
}).catch(error => {
  console.error('Check failed:', error)
  process.exit(1)
})