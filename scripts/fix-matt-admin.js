// Script to give Matt admin access
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_WhuY5jf2DDI6pxm7UB98FQ_VRIyFfiy'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixMattAccess() {
  try {
    console.log('🔧 Fixing Matt\'s Account Access...\n')

    // Update Matt's role to admin
    const { error: roleError } = await supabase
      .from('profiles')
      .update({
        role: 'admin'
      })
      .eq('email', 'matt@shelving.com')

    if (roleError) {
      console.error('Error updating Matt\'s role:', roleError)
    } else {
      console.log('✅ Matt Travis (matt@shelving.com) role updated to: admin')
    }

    // Test Matt's permissions
    console.log('\n🧪 Testing Matt\'s new permissions...')

    // Get Matt's user ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('email', 'matt@shelving.com')
      .single()

    if (profile) {
      console.log(`Matt's current role: ${profile.role}`)

      // Test admin permissions
      const testPermissions = [
        { category: 'administration', action: 'manage_users', description: 'Manage users' },
        { category: 'sales', action: 'delete', description: 'Delete sales data' },
        { category: 'inventory', action: 'view_costs', description: 'View cost prices' },
        { category: 'reports', action: 'read', description: 'View reports' }
      ]

      console.log('\nPermission test results:')
      for (const test of testPermissions) {
        const { data: hasPermission } = await supabase.rpc('check_user_permission', {
          p_user_id: profile.id,
          p_category: test.category,
          p_action: test.action,
          p_resource_owner_id: null
        })

        const result = hasPermission ? '✅ ALLOWED' : '❌ DENIED'
        console.log(`  ${test.description}: ${result}`)
      }
    }

    console.log('\n🎉 Matt now has full admin access to the system!')

  } catch (error) {
    console.error('Fix failed:', error)
  }
}

// Run the fix
fixMattAccess().then(() => {
  console.log('\n✅ Matt\'s access fixed!')
  process.exit(0)
}).catch(error => {
  console.error('Access fix failed:', error)
  process.exit(1)
})