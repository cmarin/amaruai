import { createClient } from '@/app/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Check if the user exists in the users table
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, active')
      .eq('id', session.user.id)
      .single()
    
    if (userError) {
      // User doesn't exist, create a new record with active=false
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          id: session.user.id,
          email: session.user.email,
          active: false
        }])
      
      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to create user record', details: insertError },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        active: false,
        message: 'User record created with inactive status'
      })
    }
    
    // Return the user's active status
    return NextResponse.json({
      success: true,
      active: existingUser.active,
      userId: session.user.id
    })
  } catch (error) {
    console.error('Error in sync route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 