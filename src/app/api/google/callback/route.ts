import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Validate OAuth state to prevent CSRF (skip if no cookie — manual auth flow)
  const state = searchParams.get('state')
  const storedState = request.cookies.get('google_oauth_state')?.value
  if (storedState && state !== storedState) {
    return NextResponse.redirect(new URL('/settings?google_error=invalid_state', request.url))
  }

  if (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(new URL('/settings?google_error=' + error, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?google_error=no_code', request.url))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('Google credentials not configured')
    return NextResponse.redirect(new URL('/settings?google_error=not_configured', request.url))
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenText = await tokenResponse.text()

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenResponse.status)
      return NextResponse.redirect(new URL('/settings?google_error=token_exchange_failed', request.url))
    }

    const tokenData = JSON.parse(tokenText)

    // Get user email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    const userInfo = await userInfoResponse.json()
    const email = userInfo.email

    if (!email) {
      console.error('No email in user info response')
      return NextResponse.redirect(new URL('/settings?google_error=no_email', request.url))
    }

    // Store tokens
    const supabase = createClient()
    const now = new Date()

    // Check if we have a refresh token (Google only sends it on first auth or when prompt=consent)
    const refreshToken = tokenData.refresh_token || null

    if (!refreshToken) {
      // Try to get existing refresh token from database
      const { data: existingToken } = await supabase
        .from('google_tokens')
        .select('refresh_token')
        .eq('email', email)
        .single()

      if (existingToken?.refresh_token) {
        // Update with new access token but keep existing refresh token
        const { error: updateError } = await supabase
          .from('google_tokens')
          .update({
            access_token: tokenData.access_token,
            access_token_expires_at: new Date(now.getTime() + tokenData.expires_in * 1000).toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('email', email)

        if (updateError) {
          console.error('Error updating Google tokens:', updateError)
          return NextResponse.redirect(new URL('/settings?google_error=storage_failed', request.url))
        }
      } else {
        console.error('No refresh token received and none exists in database')
        return NextResponse.redirect(new URL('/settings?google_error=no_refresh_token', request.url))
      }
    } else {
      // We have a refresh token, upsert the full record
      const { error: dbError } = await supabase
        .from('google_tokens')
        .upsert({
          email,
          access_token: tokenData.access_token,
          refresh_token: refreshToken,
          access_token_expires_at: new Date(now.getTime() + tokenData.expires_in * 1000).toISOString(),
          updated_at: now.toISOString(),
        }, {
          onConflict: 'email',
        })

      if (dbError) {
        console.error('Error storing Google tokens:', dbError)
        return NextResponse.redirect(new URL('/settings?google_error=storage_failed', request.url))
      }
    }

    const successResponse = NextResponse.redirect(new URL('/settings?google_connected=true', request.url))
    successResponse.cookies.delete('google_oauth_state')
    return successResponse

  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?google_error=unknown', request.url))
  }
}
