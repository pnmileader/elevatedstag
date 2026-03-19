import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI
  
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'QuickBooks not configured' }, { status: 500 })
  }

  // Generate a random state for CSRF protection
  const state = Math.random().toString(36).substring(2, 15)
  
  // Use the sandbox-specific authorization endpoint
  const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('com.intuit.quickbooks.accounting')}&state=${state}`

  console.log('Redirecting to:', authUrl)

  return NextResponse.redirect(authUrl)
}
