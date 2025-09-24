// Script to audit current users and sales reps for security system setup
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcwzhkeqwymqrljaadew.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_WhuY5jf2DDI6pxm7UB98FQ_VRIyFfiy'

const supabase = createClient(supabaseUrl, supabaseKey)

async function auditCurrentUsers() {
  try {
    console.log('🔍 Auditing Current Users and Sales Reps...\n')

    // Get all users/profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return
    }

    console.log('📊 Current Users in Profiles Table:')
    console.log('=====================================')
    profiles?.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.email}`)
      console.log(`   - ID: ${profile.id}`)
      console.log(`   - Role: ${profile.role}`)
      console.log(`   - Name: ${profile.first_name || 'N/A'} ${profile.last_name || 'N/A'}`)
      console.log(`   - Active: ${profile.is_active}`)
      console.log(`   - Created: ${new Date(profile.created_at).toLocaleDateString()}`)
      console.log('')
    })

    // Get all sales reps
    const { data: salesReps, error: salesRepsError } = await supabase
      .from('sales_reps')
      .select('*')
      .order('created_at', { ascending: false })

    if (salesRepsError) {
      console.error('Error fetching sales reps:', salesRepsError)
      return
    }

    console.log('🏢 Current Sales Representatives:')
    console.log('=================================')
    salesReps?.forEach((rep, index) => {
      console.log(`${index + 1}. ${rep.first_name} ${rep.last_name} (${rep.employee_code})`)
      console.log(`   - ID: ${rep.id}`)
      console.log(`   - Email: ${rep.email}`)
      console.log(`   - Territory: ${rep.territory || 'N/A'}`)
      console.log(`   - Commission: ${rep.commission_rate}%`)
      console.log(`   - User ID Link: ${rep.user_id || 'NOT LINKED'}`)
      console.log(`   - Active: ${rep.is_active}`)
      console.log('')
    })

    // Check for unlinked sales reps
    const unlinkedReps = salesReps?.filter(rep => !rep.user_id) || []
    console.log('⚠️  Unlinked Sales Reps (no user account):')
    console.log('==========================================')
    if (unlinkedReps.length === 0) {
      console.log('✅ All sales reps are linked to user accounts')
    } else {
      unlinkedReps.forEach(rep => {
        console.log(`- ${rep.first_name} ${rep.last_name} (${rep.email})`)
      })
    }

    // Check role permissions setup
    const { data: rolePermissions, error: rolePermError } = await supabase
      .from('role_permissions')
      .select('*')
      .order('role', { ascending: true })

    console.log('\n🔒 Role Permissions Status:')
    console.log('===========================')
    if (rolePermissions && rolePermissions.length > 0) {
      const roleCount = {}
      rolePermissions.forEach(perm => {
        roleCount[perm.role] = (roleCount[perm.role] || 0) + 1
      })

      Object.entries(roleCount).forEach(([role, count]) => {
        console.log(`${role}: ${count} permissions configured`)
      })
    } else {
      console.log('❌ No role permissions configured yet')
    }

    // Summary and recommendations
    console.log('\n📋 Summary & Recommendations:')
    console.log('=============================')
    console.log(`Total Users: ${profiles?.length || 0}`)
    console.log(`Total Sales Reps: ${salesReps?.length || 0}`)
    console.log(`Unlinked Sales Reps: ${unlinkedReps.length}`)

    const adminCount = profiles?.filter(p => p.role === 'admin').length || 0
    console.log(`Admin Users: ${adminCount}`)

    if (adminCount === 0) {
      console.log('⚠️  WARNING: No admin users found! You should assign at least one admin role.')
    }

    if (unlinkedReps.length > 0) {
      console.log('⚠️  ACTION NEEDED: Link sales reps to user accounts for proper permissions.')
    }

  } catch (error) {
    console.error('Error in audit:', error)
  }
}

// Run the audit
auditCurrentUsers().then(() => {
  console.log('\n✅ User audit complete!')
  process.exit(0)
}).catch(error => {
  console.error('Audit failed:', error)
  process.exit(1)
})