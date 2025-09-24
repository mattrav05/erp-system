// Script to set up security system with proper user-sales rep linkage and roles
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_WhuY5jf2DDI6pxm7UB98FQ_VRIyFfiy'

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupSecuritySystem() {
  try {
    console.log('🔧 Setting up Security System...\n')

    // Step 1: Link System Administrator to one of the admin users
    console.log('1. Linking System Administrator sales rep to admin user...')

    // Use the first admin user (Sandy) as the system admin
    const { data: linkResult, error: linkError } = await supabase
      .from('sales_reps')
      .update({
        user_id: 'f23e556d-6548-4ca6-8647-f5aa323c58a9', // Sandy's user ID
        first_name: 'System',
        last_name: 'Administrator',
        email: 'sison@shelving.com' // Match Sandy's email
      })
      .eq('employee_code', 'SYSTEM')

    if (linkError) {
      console.error('Error linking system admin:', linkError)
    } else {
      console.log('✅ System Administrator linked to Sandy Ison')
    }

    // Step 2: Assign proper roles based on user functions
    console.log('\n2. Assigning proper roles to users...')

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
          role: update.role,
          is_active: true
        })
        .eq('id', update.userId)

      if (roleError) {
        console.error(`Error updating role for ${update.name}:`, roleError)
      } else {
        console.log(`✅ ${update.name} role updated to: ${update.role}`)
      }
    }

    // Step 3: Set up territories for sales reps
    console.log('\n3. Setting up territories...')

    const territories = [
      {
        user_id: 'f23e556d-6548-4ca6-8647-f5aa323c58a9', // Sandy
        territory_name: 'All'
      },
      {
        user_id: '63f77a30-1091-4067-adda-86eeab694e35', // Travis
        territory_name: 'All' // Sales manager sees all
      },
      {
        user_id: '2c4bef33-be1a-4e73-95e6-f544198d174e', // Matt
        territory_name: 'Knowhere'
      },
      {
        user_id: '094dfc6b-1ca8-482d-bc57-c70015708d88', // Matthew
        territory_name: 'All' // Manager sees all
      }
    ]

    // Clear existing territories first
    await supabase.from('user_territories').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Insert new territories
    for (const territory of territories) {
      const { error: territoryError } = await supabase
        .from('user_territories')
        .insert(territory)

      if (territoryError) {
        console.error(`Error setting territory for user ${territory.user_id}:`, territoryError)
      } else {
        console.log(`✅ Territory "${territory.territory_name}" assigned`)
      }
    }

    // Step 4: Verify the setup
    console.log('\n4. Verifying setup...')

    const { data: profiles } = await supabase
      .from('profiles')
      .select('email, role, is_active, first_name, last_name')
      .order('role')

    console.log('\n📊 Updated User Roles:')
    console.log('====================')
    profiles?.forEach(profile => {
      console.log(`${profile.first_name} ${profile.last_name} (${profile.email}): ${profile.role}`)
    })

    const { data: salesReps } = await supabase
      .from('sales_reps')
      .select('first_name, last_name, employee_code, user_id')
      .order('employee_code')

    console.log('\n🏢 Sales Rep Linkages:')
    console.log('======================')
    salesReps?.forEach(rep => {
      const status = rep.user_id ? '✅ LINKED' : '❌ UNLINKED'
      console.log(`${rep.first_name} ${rep.last_name} (${rep.employee_code}): ${status}`)
    })

    const { data: userTerritories } = await supabase
      .from('user_territories')
      .select(`
        territory_name,
        profiles:user_id (
          first_name,
          last_name
        )
      `)

    console.log('\n🌎 Territory Assignments:')
    console.log('=========================')
    userTerritories?.forEach(territory => {
      const user = territory.profiles
      console.log(`${user?.first_name} ${user?.last_name}: ${territory.territory_name}`)
    })

    console.log('\n🎉 Security system setup complete!')
    console.log('\nNext steps:')
    console.log('- Test permission system in the application')
    console.log('- Verify sales reps can see their own data')
    console.log('- Confirm managers can access all data')
    console.log('- Test role-based UI restrictions')

  } catch (error) {
    console.error('Setup failed:', error)
  }
}

// Run the setup
setupSecuritySystem().then(() => {
  console.log('\n✅ Security setup complete!')
  process.exit(0)
}).catch(error => {
  console.error('Security setup failed:', error)
  process.exit(1)
})