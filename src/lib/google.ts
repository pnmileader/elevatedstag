import { createClient } from '@/lib/supabase'

const GOOGLE_API_BASE = 'https://www.googleapis.com'

export async function getGoogleTokens() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('google_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

export async function refreshGoogleToken(email: string, refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('Google credentials not configured')
    return null
  }

  console.log('Refreshing Google access token...')

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google token refresh failed:', response.status, errorText)
      return null
    }

    const tokenData = await response.json()
    console.log('Google token refresh successful!')

    // Update tokens in database
    const supabase = createClient()
    const now = new Date()
    
    await supabase
      .from('google_tokens')
      .update({
        access_token: tokenData.access_token,
        access_token_expires_at: new Date(now.getTime() + tokenData.expires_in * 1000).toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('email', email)

    return tokenData.access_token
    
  } catch (err) {
    console.error('Google token refresh error:', err)
    return null
  }
}

export async function getValidGoogleToken(): Promise<{ accessToken: string; email: string } | null> {
  const tokens = await getGoogleTokens()
  
  if (!tokens) {
    return null
  }

  const now = new Date()
  const expiresAt = new Date(tokens.access_token_expires_at)
  const timeUntilExpiry = expiresAt.getTime() - now.getTime()

  // If token expires in less than 5 minutes, refresh it
  if (timeUntilExpiry < 5 * 60 * 1000) {
    console.log('Google token expired or expiring soon, refreshing...')
    
    const newAccessToken = await refreshGoogleToken(tokens.email, tokens.refresh_token)
    
    if (newAccessToken) {
      return { accessToken: newAccessToken, email: tokens.email }
    } else {
      return null
    }
  }

  return { accessToken: tokens.access_token, email: tokens.email }
}

export async function googleCalendarRequest(endpoint: string, options: RequestInit = {}) {
  const auth = await getValidGoogleToken()
  
  if (!auth) {
    throw new Error('Not connected to Google Calendar')
  }

  const url = `${GOOGLE_API_BASE}/calendar/v3${endpoint}`
  
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
    console.error('Google Calendar API error:', response.status, errorText)
    
    if (response.status === 401) {
      // Try refresh
      const tokens = await getGoogleTokens()
      if (tokens) {
        const newToken = await refreshGoogleToken(tokens.email, tokens.refresh_token)
        if (newToken) {
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
    
    throw new Error(`Google Calendar API error: ${response.status}`)
  }

  return response.json()
}

// Calendar helper functions
export async function getCalendarEvents(timeMin: string, timeMax: string) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  
  return googleCalendarRequest(`/calendars/primary/events?${params}`)
}

export async function createCalendarEvent(event: {
  summary: string
  description?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  location?: string
}) {
  return googleCalendarRequest('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(event),
  })
}

export async function updateCalendarEvent(eventId: string, event: {
  summary?: string
  description?: string
  start?: { dateTime: string; timeZone?: string }
  end?: { dateTime: string; timeZone?: string }
  location?: string
}) {
  return googleCalendarRequest(`/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(event),
  })
}

export async function deleteCalendarEvent(eventId: string) {
  const auth = await getValidGoogleToken()
  
  if (!auth) {
    throw new Error('Not connected to Google Calendar')
  }

  const response = await fetch(
    `${GOOGLE_API_BASE}/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${auth.accessToken}`,
      },
    }
  )

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete event: ${response.status}`)
  }

  return true
}
