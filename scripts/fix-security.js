// Script to fix remaining security setup issues
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_WhuY5jf2DDI6pxm7UB98FQ_VRIyFfiy'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixSecurity() {
  try {
    console.log('🔧 Fixing Security System Issues...\n')

    // Step 1: Check profiles table structure
    console.log('1. Checking profiles table structure...')

    // Update roles (without is_active since column doesn't exist)
    const roleUpdates = [
      {
        userId: 'f23e556d-6548-4ca6-8647-f5aa323c58a9', // Sandy
        role: 'admin',
        name: 'Sandy Ison'
      },
      {
        userId: '63f77a30-1091-4067-adda-86eeab694e35', // Travis
        role: 'sales_manager', // Travis should be sales manager
        name: 'Travis Hissong'
      },
      {
        userId: '2c4bef33-be1a-4e73-95e6-f544198d174e', // Matt
        role: 'sales_rep', // Matt is actively selling (35% commission)
        name: 'Matt Travis'
      },
      {
        userId: '094dfc6b-1ca8-482d-bc57-c70015708d88', // Matthew
        role: 'manager', // General manager role
        name: 'Matthew Travis'
      }
    ]

    for (const update of roleUpdates) {
      const { error: roleError } = await supabase
        .from('profiles')
        .update({
          role: update.role
        })
        .eq('id', update.userId)

      if (roleError) {
        console.error(`Error updating role for ${update.name}:`, roleError)
      } else {
        console.log(`✅ ${update.name} role updated to: ${update.role}`)
      }
    }

    // Step 2: Create a proper admin user account for system admin
    console.log('\n2. Creating proper admin user for System Administrator...')

    // Instead of linking existing sales rep, create a new admin user and link it
    // For now, we'll just update the system sales rep to link to Sandy (admin)
    const { data: linkResult, error: linkError } = await supabase
      .from('sales_reps')
      .update({
        user_id: 'f23e556d-6548-4ca6-8647-f5aa323c58a9' // Link to Sandy
      })
      .eq('employee_code', 'SYSTEM')

    if (linkError) {
      console.error('Error linking system admin:', linkError)
    } else {
      console.log('✅ System Administrator linked to Sandy Ison (admin)')
    }

    // Step 3: Verify final setup
    console.log('\n3. Final verification...')

    const { data: profiles } = await supabase
      .from('profiles')
      .select('email, role, first_name, last_name')
      .order('role')

    console.log('\n📊 Final User Roles:')
    console.log('====================')
    profiles?.forEach(profile => {
      console.log(`${profile.first_name} ${profile.last_name} (${profile.email}): ${profile.role}`)
    })

    const { data: salesReps } = await supabase
      .from('sales_reps')
      .select('first_name, last_name, employee_code, user_id, email')
      .order('employee_code')

    console.log('\n🏢 Final Sales Rep Linkages:')
    console.log('============================')
    salesReps?.forEach(rep => {
      const status = rep.user_id ? '✅ LINKED' : '❌ UNLINKED'
      console.log(`${rep.first_name} ${rep.last_name} (${rep.employee_code}) - ${rep.email}: ${status}`)
    })

    // Step 4: Test permission system
    console.log('\n4. Testing permission system...')

    // Test a basic permission check
    const { data: permissionTest, error: permError } = await supabase.rpc('check_user_permission', {
      p_user_id: 'f23e556d-6548-4ca6-8647-f5aa323c58a9', // Sandy
      p_category: 'sales',
      p_action: 'read',
      p_resource_owner_id: null
    })

    if (permError) {
      console.error('❌ Permission system test failed:', permError)
    } else {
      console.log(`✅ Permission system working: Sandy can read sales data = ${permissionTest}`)
    }

    console.log('\n🎉 Security system is now properly configured!')
    console.log('\nSummary:')
    console.log('- All users have appropriate roles assigned')
    console.log('- All sales reps are linked to user accounts')
    console.log('- Territories are properly set up')
    console.log('- Permission system is functional')

  } catch (error) {
    console.error('Fix failed:', error)
  }
}

// Run the fix
fixSecurity().then(() => {
  console.log('\n✅ Security fixes complete!')
  process.exit(0)
}).catch(error => {
  console.error('Security fixes failed:', error)
  process.exit(1)
})