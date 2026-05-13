import { createClient } from '@/lib/supabase'

export type LineItemCategory = 'custom' | 'ready_made' | 'service' | 'discount' | 'skip' | 'unknown'
export type GarmentType = 'suit' | 'jacket' | 'pant' | 'shirt' | 'vest' | 'sport_coat' | 'other'

export interface ParsedLineItem {
  category: LineItemCategory
  brand?: string
  garment_type?: GarmentType
  size?: string
  code?: string
}

// Custom garment codes — longest first so CSHT matches before CSH etc.
const CUSTOM_CODE_MAP: Array<{ code: string; garment: GarmentType }> = [
  { code: 'CCVP', garment: 'suit' },
  { code: 'COVP', garment: 'suit' },
  { code: 'CSHT', garment: 'shirt' },
  { code: 'CSHO', garment: 'pant' },
  { code: 'CCP',  garment: 'suit' },
  { code: 'COP',  garment: 'suit' },
  { code: 'CSC',  garment: 'sport_coat' },
  { code: 'CSH',  garment: 'shirt' },
  { code: 'COF',  garment: 'other' },
  { code: 'CT',   garment: 'pant' },
  { code: 'CV',   garment: 'vest' },
  { code: 'CB',   garment: 'jacket' },
  { code: 'CC',   garment: 'jacket' },
]

// Custom-by-keyword (no formal code): "Custom Tuxedo", "Custom Sweater", "Custom Jeans", etc.
const CUSTOM_KEYWORDS: Array<{ pattern: RegExp; garment: GarmentType }> = [
  { pattern: /\bcustom\s+tuxedo\b/i,           garment: 'suit' },
  { pattern: /\bcustom\s+cashmere\s+sweater\b/i, garment: 'other' },
  { pattern: /\bcustom\s+sweater\b/i,          garment: 'other' },
  { pattern: /\bcustom\s+jeans\b/i,            garment: 'pant' },
  { pattern: /\bcustom\s+sport[\s-]?coat\b/i,  garment: 'sport_coat' },
  { pattern: /\bcustom\s+suit\b/i,             garment: 'suit' },
  { pattern: /\bcustom\s+jacket\b/i,           garment: 'jacket' },
  { pattern: /\bcustom\s+bomber\b/i,           garment: 'jacket' },
  { pattern: /\bcustom\s+coat\b/i,             garment: 'jacket' },
  { pattern: /\bcustom\s+(pant|trouser)s?\b/i, garment: 'pant' },
  { pattern: /\bcustom\s+shorts?\b/i,          garment: 'pant' },
  { pattern: /\bcustom\s+vest\b/i,             garment: 'vest' },
  { pattern: /\bcustom\s+shirt\b/i,            garment: 'shirt' },
]

// Known ready-made brand patterns, longest/most-specific first.
const READY_MADE_BRANDS: Array<{ pattern: RegExp; brand: string }> = [
  { pattern: /\bholderness\s*&?\s*bourne\b/i, brand: 'Holderness & Bourne' },
  { pattern: /\bjohnston\s*&?\s*murphy\b/i,   brand: 'Johnston & Murphy' },
  { pattern: /\bdead\s*soxy\b/i,              brand: 'Dead Soxy' },
  { pattern: /\bblue\s*delta\b/i,             brand: 'Blue Delta' },
  { pattern: /\b34\s*heritage\b/i,            brand: '34 Heritage' },
  { pattern: /\b7\s*diamonds\b/i,             brand: '7Diamonds' },
  { pattern: /\bliverpool\b/i,                brand: 'Liverpool' },
  { pattern: /\bmagnann?i\b/i,                brand: 'Magnanni' },
  { pattern: /\bpaige\b/i,                    brand: 'Paige' },
  // J&M / JM — short tokens, require word boundaries and the ampersand or specific context to avoid false matches
  { pattern: /\bJ\s*&\s*M\b/,                 brand: 'Johnston & Murphy' },
  { pattern: /(^|[:\s])JM\b/,                 brand: 'Johnston & Murphy' },
]

// Furniture / fixture / lighting words — interior design line items without the prefix.
const FIXTURE_WORDS = [
  /\bdelta\b/i, /\bkohler\b/i, /\bmatthews\b/i, /\bpossini\b/i,
  /\belegant\s+lighting\b/i,
  /\bpendants?\b/i, /\bvanity\s+light\b/i, /\bflush\s+mount\b/i,
  /\blantern\b/i, /\bsconce\b/i, /\bmirror\b/i, /\btile\b/i,
  /\bwallpaper\b/i, /\bfaucet\b/i, /\btub\b/i, /\bsink\b/i,
  /\bshower\b/i,
  // Plain "Light" / "Lights" matched last so we don't catch "Lighting Charge" etc. on its own
  /\bbulbs?\b/i,
]

// Specific wardrobe-styling-as-service labels.
const WARDROBE_SERVICE_LABELS = [
  /\bpersonal\s+styling\b/i,
  /\bmonthly\s+vip\b/i, /\bvip\s+concierge\b/i,
  /\bcuts\b/i,
  /\bdry\s+cleaning\b/i,
  /\bshipping\b/i,
  /\btips?\b/i,
  /\bconvenience\s+fee\b/i,
  /\brush\s+fee\b/i,
  /\bshoe\s+repair\b/i,
  /\bcustom\s+lining\s+charge\b/i,
  /\balterations?\b/i,
  /\bcustom\s+amount\b/i,
  /\bcustom\s+clothing\s+gift\s+certificate\b/i,
  /\bdesigner\s+fee\b/i,
  /\badjustment\s+from\s+prior\s+period\b/i,
  /\berc\s+tax\s+credit\b/i,
  /\binterest\s+earned\b/i,
  /\bstyling\s+fee\b/i,
  /\bconsultation\b/i,
]

// Discount/credit/complimentary tokens.
const DISCOUNT_PATTERNS = [
  /\bdiscount\b/i,
  /\bcredit\b/i,
  /\bcomplimentary\b/i,
  /\bbuy\s+\d+\s+get\s+\d+\s+free\b/i,
  /\bfriends\s*&?\s*family\b/i,
]

// Generic ready-made labels after "Wardrobe Styling:" — brand stays null.
const GENERIC_READY_MADE_KEYWORDS = [
  /\bready[\s-]?made\b/i,
  /^shoes$/i, /\bshoes?\b/i,
  /\bbelt\b/i,
  /\bsocks?\b/i,
  /\btie\b/i,
  /\bpocket\s*square\b/i,
  /\baccessor(y|ies)\b/i,
  /\bpolo\b/i,
]

// Stop words that shouldn't be treated as brand when extracting from description.
const BRAND_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'in',
  'navy', 'black', 'white', 'blue', 'red', 'grey', 'gray', 'green', 'tan', 'brown',
  'charcoal', 'olive', 'beige', 'cream', 'burgundy', 'pink', 'orange', 'yellow',
  'dark', 'light', 'med', 'medium', 'pale', 'deep',
  'size', 'small', 'large', 'xl', 'xxl', 'xs', 's', 'm', 'l',
  'cotton', 'wool', 'linen', 'silk', 'cashmere', 'leather', 'denim',
])

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

function extractBrandFromDescription(desc: string): string | undefined {
  if (!desc) return undefined
  const tokens = desc.split(/[\s,]+/).filter(Boolean)
  if (tokens.length === 0) return undefined
  const first = tokens[0]
  if (BRAND_STOP_WORDS.has(first.toLowerCase())) return undefined
  if (/^\d/.test(first)) return undefined
  return first
}

// Strip the common "Section:" prefix (e.g., "Wardrobe Styling:CCP - Custom...") so subsequent
// matching is easier. Returns both the stripped name and the original section if present.
function stripSectionPrefix(name: string): { section: string | null; rest: string } {
  const m = name.match(/^([^:]+):(.*)$/)
  if (!m) return { section: null, rest: name }
  return { section: m[1].trim(), rest: m[2].trim() }
}

export function parseInvoiceLineItem(productName: string, description: string = ''): ParsedLineItem {
  const rawName = (productName || '').trim()
  const desc = (description || '').trim()

  if (!rawName) return { category: 'unknown' }

  const { section, rest } = stripSectionPrefix(rawName)

  // (1) Hard-skip prefixes: anything in Interior Design / Renovation / Organizing namespaces.
  if (section) {
    const sectionLower = section.toLowerCase()
    if (sectionLower === 'interior design' || sectionLower === 'renovation' || sectionLower === 'organizing') {
      return { category: 'skip' }
    }
  }

  // (2) Known ready-made brand patterns — checked FIRST so e.g. "Blue Delta" wins
  // over the bare "Delta" fixture rule below.
  for (const { pattern, brand } of READY_MADE_BRANDS) {
    if (pattern.test(rest)) {
      return { category: 'ready_made', brand, size: parseSize(desc) }
    }
  }

  // (3) Wardrobe styling services / fees / accounting line items — BEFORE discount,
  // so "ERC Tax Credit" lands as service instead of matching /credit/.
  for (const re of WARDROBE_SERVICE_LABELS) {
    if (re.test(rest)) {
      return { category: 'service' }
    }
  }

  // (4) Discounts / credits / complimentary.
  for (const re of DISCOUNT_PATTERNS) {
    if (re.test(rest)) {
      return { category: 'discount' }
    }
  }

  // (5) Furniture / fixture / lighting words — interior design items without the prefix.
  for (const re of FIXTURE_WORDS) {
    if (re.test(rest) || re.test(rawName)) {
      return { category: 'skip' }
    }
  }

  // (6) Custom garment codes (longest first via array order).
  for (const { code, garment } of CUSTOM_CODE_MAP) {
    const re = new RegExp(`\\b${code}\\b`)
    if (re.test(rest)) {
      return { category: 'custom', garment_type: garment, code, size: parseSize(desc) }
    }
  }

  // (7) Custom-by-keyword.
  for (const { pattern, garment } of CUSTOM_KEYWORDS) {
    if (pattern.test(rest)) {
      return { category: 'custom', garment_type: garment, size: parseSize(desc) }
    }
  }

  // (8) Generic "Wardrobe Styling:Ready Made Clothing" — try to pull brand from description.
  if (/\bready[\s-]?made\b/i.test(rest)) {
    const brand = extractBrandFromDescription(desc)
    return { category: 'ready_made', ...(brand ? { brand } : {}), size: parseSize(desc) }
  }

  // (9) Generic accessory / no-brand ready-made labels.
  for (const re of GENERIC_READY_MADE_KEYWORDS) {
    if (re.test(rest)) {
      return { category: 'ready_made', size: parseSize(desc) }
    }
  }

  // (10) Fallback "Custom <something>" without a specific keyword match.
  if (/\bcustom\b/i.test(rest)) {
    return { category: 'custom', garment_type: 'other', size: parseSize(desc) }
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
