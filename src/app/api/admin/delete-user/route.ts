import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check if environment variables are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey
      })
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Create admin client with service role key (server-side only)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    console.log('Attempting to delete user:', userId)

    // First, try to delete the profile manually (in case cascade doesn't work)
    try {
      const { error: profileError } = await adminClient
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (profileError) {
        console.error('Error deleting profile:', profileError)
        // Continue anyway, maybe the cascade will handle it
      } else {
        console.log('Profile deleted successfully')
      }
    } catch (profileDeleteError) {
      console.error('Profile deletion attempt failed:', profileDeleteError)
      // Continue anyway
    }

    // Delete user from Supabase Auth
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Error deleting user from auth:', authError)
      return NextResponse.json(
        { error: `Database error deleting user: ${authError.message}` },
        { status: 500 }
      )
    }

    console.log('User deleted successfully from auth')
    return NextResponse.json({ success: true, message: 'User deleted successfully' })

  } catch (error) {
    console.error('Error in delete user API:', error)
    return NextResponse.json(
      { error: `Database error deleting user: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}