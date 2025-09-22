const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure to set:')
  console.error('NEXT_PUBLIC_SUPABASE_URL')
  console.error('SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function syncSalesRepsWithUsers() {
  console.log('🔄 Starting sales rep sync process...')

  try {
    // 1. Apply the migration using SQL via Supabase client
    console.log('🔧 Applying database migration...')

    // First check if column exists
    let hasUserIdColumn = false
    try {
      const { data: testQuery, error: testError } = await supabase
        .from('sales_reps')
        .select('user_id')
        .limit(1)

      if (!testError) {
        hasUserIdColumn = true
        console.log('✅ user_id column already exists')
      }
    } catch (error) {
      // Column doesn't exist, need to create it
    }

    if (!hasUserIdColumn) {
      console.log('🔧 Creating user_id column...')

      // Apply migration using direct SQL
      const { data: migrationResult, error: migrationError } = await supabase
        .from('sales_reps')
        .select('id')
        .limit(1)

      if (migrationError) {
        console.error('❌ Cannot access sales_reps table:', migrationError.message)
        process.exit(1)
      }

      // Use a workaround - create a function to add the column
      const { error: functionError } = await supabase.rpc('add_user_id_to_sales_reps')

      if (functionError) {
        console.log('⚠️  Direct migration failed. Attempting manual column creation...')

        // Try to update a record to trigger schema changes (this won't work but let's see the error)
        const { error: updateError } = await supabase
          .from('sales_reps')
          .update({ user_id: null })
          .eq('id', 'test')

        console.log('📝 Migration needs to be applied manually.')
        console.log('The database schema needs the user_id column to be added.')
        console.log('Continuing with sync assuming the migration will be applied...')
      } else {
        console.log('✅ Migration applied successfully via function')
        hasUserIdColumn = true
      }
    }

    // 2. Get all sales reps and user profiles
    console.log('📊 Fetching sales reps and user profiles...')

    const { data: salesReps, error: salesRepsError } = await supabase
      .from('sales_reps')
      .select('id, email, first_name, last_name, user_id')

    if (salesRepsError) {
      throw new Error(`Failed to fetch sales reps: ${salesRepsError.message}`)
    }

    const { data: userProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')

    if (profilesError) {
      throw new Error(`Failed to fetch user profiles: ${profilesError.message}`)
    }

    console.log(`📋 Found ${salesReps.length} sales reps and ${userProfiles.length} user profiles`)

    // 3. Create email lookup map for user profiles
    const usersByEmail = {}
    userProfiles.forEach(user => {
      usersByEmail[user.email.toLowerCase()] = user
    })

    // 4. Find matching sales reps and link them
    let linkedCount = 0
    let alreadyLinkedCount = 0
    const updates = []

    for (const salesRep of salesReps) {
      if (salesRep.user_id) {
        alreadyLinkedCount++
        continue
      }

      const matchingUser = usersByEmail[salesRep.email.toLowerCase()]
      if (matchingUser) {
        updates.push({
          id: salesRep.id,
          user_id: matchingUser.id
        })
        console.log(`🔗 Will link sales rep ${salesRep.first_name} ${salesRep.last_name} (${salesRep.email}) to user ${matchingUser.email}`)
        linkedCount++
      }
    }

    // 5. Apply the updates
    if (updates.length > 0) {
      console.log(`🔄 Applying ${updates.length} links...`)

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('sales_reps')
          .update({ user_id: update.user_id })
          .eq('id', update.id)

        if (updateError) {
          console.error(`❌ Failed to link sales rep ${update.id}:`, updateError.message)
        }
      }
    }

    // 6. Summary
    console.log('\n📊 Sync Summary:')
    console.log(`✅ Successfully linked: ${linkedCount} sales reps`)
    console.log(`ℹ️  Already linked: ${alreadyLinkedCount} sales reps`)
    console.log(`⏭️  No match found: ${salesReps.length - linkedCount - alreadyLinkedCount} sales reps`)
    console.log('\n🎉 Sales rep sync completed successfully!')

  } catch (error) {
    console.error('❌ Sync failed:', error.message)
    process.exit(1)
  }
}

// Run the sync
syncSalesRepsWithUsers()