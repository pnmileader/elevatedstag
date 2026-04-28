import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'QuickBooks not configured' }, { status: 500 })
  }

  // Generate a cryptographically secure state for CSRF protection
  const state = crypto.randomUUID()

  // Use the sandbox-specific authorization endpoint
  const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('com.intuit.quickbooks.accounting')}&state=${state}`

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('quickbooks_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 600 })
  return response
}
