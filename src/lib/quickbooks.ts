import { createClient } from '@/lib/supabase'

const QB_API_BASE_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com'
const QB_API_BASE_PRODUCTION = 'https://quickbooks.api.intuit.com'

function getApiBase() {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production' 
    ? QB_API_BASE_PRODUCTION 
    : QB_API_BASE_SANDBOX
}

export async function getQuickBooksTokens() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('quickbooks_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    console.log('No QuickBooks tokens found')
    return null
  }

  return data
}

export async function refreshAccessToken(realmId: string, refreshToken: string): Promise<string | null> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('QuickBooks credentials not configured')
    return null
  }

  console.log('Refreshing QuickBooks access token...')
  
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  try {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Token refresh failed:', response.status, errorText)
      return null
    }

    const tokenData = await response.json()
    console.log('Token refresh successful!')

    // Update tokens in database
    const supabase = createClient()
    const now = new Date()
    
    const { error: updateError } = await supabase
      .from('quickbooks_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        access_token_expires_at: new Date(now.getTime() + tokenData.expires_in * 1000).toISOString(),
        refresh_token_expires_at: new Date(now.getTime() + tokenData.x_refresh_token_expires_in * 1000).toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('realm_id', realmId)

    if (updateError) {
      console.error('Failed to save refreshed tokens:', updateError)
    }

    return tokenData.access_token
    
  } catch (err) {
    console.error('Token refresh error:', err)
    return null
  }
}

export async function getValidAccessToken(): Promise<{ accessToken: string; realmId: string } | null> {
  const tokens = await getQuickBooksTokens()
  
  if (!tokens) {
    console.log('No tokens available')
    return null
  }

  const now = new Date()
  const expiresAt = new Date(tokens.access_token_expires_at)
  const timeUntilExpiry = expiresAt.getTime() - now.getTime()
  
  console.log(`Token expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`)

  // If token expires in less than 5 minutes, refresh it
  if (timeUntilExpiry < 5 * 60 * 1000) {
    console.log('Token expired or expiring soon, refreshing...')
    
    const newAccessToken = await refreshAccessToken(tokens.realm_id, tokens.refresh_token)
    
    if (newAccessToken) {
      return { accessToken: newAccessToken, realmId: tokens.realm_id }
    } else {
      console.error('Failed to refresh token')
      return null
    }
  }

  return { accessToken: tokens.access_token, realmId: tokens.realm_id }
}

export async function quickBooksRequest(endpoint: string, options: RequestInit = {}) {
  const auth = await getValidAccessToken()
  
  if (!auth) {
    throw new Error('Not connected to QuickBooks')
  }

  const url = `${getApiBase()}/v3/company/${auth.realmId}${endpoint}`
  
  console.log('QuickBooks API request:', endpoint)
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.accessToken}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('QuickBooks API error:', response.status, errorText)
    
    // If we get a 401, the token might be invalid even though we thought it was valid
    if (response.status === 401) {
      console.log('Got 401, attempting token refresh...')
      const tokens = await getQuickBooksTokens()
      if (tokens) {
        const newToken = await refreshAccessToken(tokens.realm_id, tokens.refresh_token)
        if (newToken) {
          // Retry the request with new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newToken}`,
              ...options.headers,
            },
          })
          
          if (retryResponse.ok) {
            return retryResponse.json()
          }
        }
      }
    }
    
    throw new Error(`QuickBooks API error: ${response.status}`)
  }

  return response.json()
}
