import { createClient } from '@/lib/supabase'

export type LineItemCategory = 'custom' | 'ready_made' | 'service' | 'discount' | 'unknown'
export type GarmentType = 'suit' | 'jacket' | 'pant' | 'shirt' | 'vest' | 'sport_coat' | 'other'

export interface ParsedLineItem {
  category: LineItemCategory
  brand?: string
  garment_type?: GarmentType
  size?: string
  code?: string
}

const CUSTOM_CODE_MAP: Array<{ code: string; garment: GarmentType }> = [
  { code: 'CCVP', garment: 'suit' },
  { code: 'COVP', garment: 'suit' },
  { code: 'CCP',  garment: 'suit' },
  { code: 'COP',  garment: 'suit' },
  { code: 'CSC',  garment: 'sport_coat' },
  { code: 'CSHT', garment: 'shirt' },
  { code: 'CSH',  garment: 'shirt' },
  { code: 'COF',  garment: 'other' },
  { code: 'CT',   garment: 'pant' },
  { code: 'CV',   garment: 'vest' },
  { code: 'CC',   garment: 'jacket' },
]

const GENERIC_GARMENT_WORDS: Array<{ pattern: RegExp; garment: GarmentType }> = [
  { pattern: /\bsuit\b/i,        garment: 'suit' },
  { pattern: /\bsport[\s-]?coat\b/i, garment: 'sport_coat' },
  { pattern: /\bjacket\b/i,      garment: 'jacket' },
  { pattern: /\bcoat\b/i,        garment: 'jacket' },
  { pattern: /\b(pant|trouser)s?\b/i, garment: 'pant' },
  { pattern: /\bvest\b/i,        garment: 'vest' },
  { pattern: /\bshirt\b/i,       garment: 'shirt' },
  { pattern: /\bshorts?\b/i,     garment: 'pant' },
]

const READY_MADE_BRANDS: Array<{ pattern: RegExp; brand: string }> = [
  { pattern: /magnann?i/i,        brand: 'Magnanni' },
  { pattern: /34\s*heritage/i,    brand: '34 Heritage' },
  { pattern: /7\s*diamonds/i,     brand: '7Diamonds' },
]

function parseSize(description: string): string | undefined {
  if (!description) return undefined
  const patterns: RegExp[] = [
    /\bsize\s+([0-9]+(?:\.[0-9]+)?(?:\s*[x\/]\s*[0-9]+(?:\.[0-9]+)?)?)/i,
    /\b([0-9]+\s*[x\/]\s*[0-9]+)\b/,
    /\b([0-9]+\.[0-9]+)\b/,
    /\b([0-9]{2,3})\b/,
    /\b(XXL|XLarge|XL|XS|Small|Medium|Large)\b/i,
  ]
  for (const re of patterns) {
    const m = description.match(re)
    if (m) return m[1].replace(/\s+/g, '')
  }
  return undefined
}

export function parseInvoiceLineItem(productName: string, description: string = ''): ParsedLineItem {
  const name = (productName || '').trim()
  const desc = (description || '').trim()

  if (!name) return { category: 'unknown' }

  if (/\b(discount|friends\s*&?\s*family|adjustment|refund)\b/i.test(name)) {
    return { category: 'discount' }
  }

  if (/\b(alterations?|styling\s*fee|service|consultation)\b/i.test(name)) {
    return { category: 'service' }
  }

  for (const { pattern, brand } of READY_MADE_BRANDS) {
    if (pattern.test(name)) {
      return { category: 'ready_made', brand, size: parseSize(desc) }
    }
  }

  if (/\bready[\s-]?made\b/i.test(name)) {
    let brand: string | undefined
    if (desc) {
      const first = desc.split(/[\s,]+/).filter(Boolean).slice(0, 2).join(' ')
      brand = first || 'Unknown'
    } else {
      brand = 'Unknown'
    }
    return { category: 'ready_made', brand, size: parseSize(desc) }
  }

  for (const { code, garment } of CUSTOM_CODE_MAP) {
    const re = new RegExp(`\\b${code}\\b`)
    if (re.test(name)) {
      return { category: 'custom', garment_type: garment, code, size: parseSize(desc) }
    }
  }

  if (/\bcustom\b/i.test(name)) {
    for (const { pattern, garment } of GENERIC_GARMENT_WORDS) {
      if (pattern.test(name)) return { category: 'custom', garment_type: garment, size: parseSize(desc) }
    }
    return { category: 'custom', garment_type: 'other', size: parseSize(desc) }
  }

  for (const { pattern, garment } of GENERIC_GARMENT_WORDS) {
    if (pattern.test(name)) {
      const brandLeadingPattern = /^(wardrobe\s+styling\s+)?(magnann?i|34\s*heritage|7\s*diamonds|peter\s+millar|canali|zegna)/i
      if (brandLeadingPattern.test(name)) {
        return { category: 'ready_made', brand: name.replace(/wardrobe\s+styling\s+/i, '').trim(), size: parseSize(desc) }
      }
      return { category: 'custom', garment_type: garment, size: parseSize(desc) }
    }
  }

  if (/\b(belt|socks?|tie|pocket\s*square|cufflinks?|accessor(y|ies))\b/i.test(name)) {
    return { category: 'ready_made', size: parseSize(desc) }
  }

  return { category: 'unknown' }
}

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
