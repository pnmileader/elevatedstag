import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Validate OAuth state to prevent CSRF
  const state = searchParams.get('state')
  const storedState = request.cookies.get('quickbooks_oauth_state')?.value
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/settings?qb_error=invalid_state', request.url))
  }

  if (error) {
    console.error('QuickBooks OAuth error:', error, errorDescription)
    return NextResponse.redirect(new URL('/settings?qb_error=' + encodeURIComponent(error), request.url))
  }

  if (!code || !realmId) {
    console.error('Missing required OAuth params')
    return NextResponse.redirect(new URL('/settings?qb_error=missing_params', request.url))
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL('/settings?qb_error=not_configured', request.url))
  }

  try {
    // Exchange authorization code for tokens
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    })

    const responseText = await tokenResponse.text()

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenResponse.status)
      return NextResponse.redirect(new URL('/settings?qb_error=token_exchange_failed', request.url))
    }

    const tokenData = JSON.parse(responseText)

    // Calculate expiration times
    const now = new Date()
    const accessTokenExpiresAt = new Date(now.getTime() + tokenData.expires_in * 1000)
    const refreshTokenExpiresAt = new Date(now.getTime() + tokenData.x_refresh_token_expires_in * 1000)

    // Store tokens in Supabase
    const supabase = createClient()

    const { error: dbError } = await supabase
      .from('quickbooks_tokens')
      .upsert({
        realm_id: realmId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'realm_id',
      })

    if (dbError) {
      console.error('Error storing tokens:', dbError)
      return NextResponse.redirect(new URL('/settings?qb_error=storage_failed', request.url))
    }

    const successResponse = NextResponse.redirect(new URL('/settings?qb_connected=true', request.url))
    successResponse.cookies.delete('quickbooks_oauth_state')
    return successResponse

  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?qb_error=unknown', request.url))
  }
}
