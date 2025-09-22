import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      isSalesRep,
      employeeCode,
      phone,
      commissionRate,
      territory,
      hireDate
    } = await request.json()

    console.log('Creating user with email:', email)

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      )
    }

    // Create admin client with service role key (server-side only)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check for existing user by email first
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers.users?.find(u => u.email === email)

    if (existingUser) {
      console.log('User already exists with email:', email)
      return NextResponse.json(
        { error: `User with email ${email} already exists` },
        { status: 400 }
      )
    }

    // Create user via Supabase Auth Admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    })

    if (authError) {
      console.error('Error creating user in auth:', authError)
      return NextResponse.json(
        { error: `Failed to create user: ${authError.message}` },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user: No user data returned' },
        { status: 500 }
      )
    }

    // Check if profile already exists (in case of previous failed creation)
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    let profile = existingProfile

    if (!existingProfile) {
      // Create profile entry
      const { data: newProfile, error: profileError } = await adminClient
        .from('profiles')
        .insert({
          id: authData.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          role: role || 'user'
        })
        .select()
        .single()

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // If profile creation fails, clean up the auth user
        await adminClient.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json(
          { error: `Failed to create user profile: ${profileError.message}` },
          { status: 500 }
        )
      }

      profile = newProfile
    } else {
      // Profile already exists, update it with new information
      const { data: updatedProfile, error: updateError } = await adminClient
        .from('profiles')
        .update({
          email,
          first_name: firstName,
          last_name: lastName,
          role: role || 'user',
          updated_at: new Date().toISOString()
        })
        .eq('id', authData.user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating existing profile:', updateError)
        return NextResponse.json(
          { error: `Failed to update user profile: ${updateError.message}` },
          { status: 500 }
        )
      }

      profile = updatedProfile
    }

    // Create sales rep profile if user is marked as sales rep
    if (isSalesRep && employeeCode) {
      try {
        const { error: salesRepError } = await adminClient
          .from('sales_reps')
          .insert({
            employee_code: employeeCode,
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone || null,
            commission_rate: commissionRate || 0,
            territory: territory || null,
            hire_date: hireDate || null,
            is_active: true,
            user_id: authData.user.id
          })

        if (salesRepError) {
          console.warn('Sales rep profile creation failed:', salesRepError)
          // Don't fail the entire user creation for this
        }
      } catch (error) {
        console.warn('Sales rep table may not exist yet:', error)
        // This is expected for new installations
      }
    }

    return NextResponse.json({
      success: true,
      user: profile,
      message: 'User created successfully'
    })

  } catch (error) {
    console.error('Error in create user API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}