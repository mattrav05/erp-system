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
    // 1. Check if user_id column exists by trying to select it
    console.log('🔍 Checking if user_id column exists...')

    let hasUserIdColumn = false
    try {
      const { data: testQuery, error: testError } = await supabase
        .from('sales_reps')
        .select('user_id')
        .limit(1)

      if (!testError) {
        hasUserIdColumn = true
        console.log('✅ user_id column exists')
      }
    } catch (error) {
      // Column doesn't exist
    }

    if (!hasUserIdColumn) {
      console.log('❌ user_id column does not exist in sales_reps table')
      console.log('\n⚠️  Manual migration required!')
      console.log('Please apply the following SQL in Supabase Studio SQL Editor:')
      console.log('1. Go to: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new')
      console.log('2. Run the following SQL:')
      console.log('')
      console.log('ALTER TABLE sales_reps ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;')
      console.log('CREATE INDEX idx_sales_reps_user_id ON sales_reps(user_id);')
      console.log('')
      console.log('3. Then re-run this script')
      process.exit(1)
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