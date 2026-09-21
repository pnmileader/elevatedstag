import { Resend } from 'resend'

// Katie wants mail to come from her real address (no "mail." subdomain).
// Resend only accepts a From domain whose DKIM/SPF records are verified, and
// today only mail.theelevatedstag.com is. So: try the preferred address, and if
// Resend says the domain isn't verified, fall back to the verified subdomain so
// email never breaks. The day theelevatedstag.com is verified in Resend, sends
// switch to the preferred address on their own — no deploy needed.
const PREFERRED_FROM = process.env.EMAIL_FROM || 'Katie Fore <katie@theelevatedstag.com>'
const VERIFIED_FROM = process.env.EMAIL_FROM_FALLBACK || 'Katie Fore <katie@mail.theelevatedstag.com>'
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO || 'katie@theelevatedstag.com'

// Remember a "domain not verified" answer for a while so a 60-person mass
// email doesn't spend 60 extra API calls (Resend rate-limits at ~2/sec).
const RECHECK_PREFERRED_MS = 15 * 60 * 1000
let preferredBlockedUntil = 0

function isUnverifiedDomainError(error: { message?: string; name?: string; statusCode?: number | null }): boolean {
  // Two shapes seen from Resend: the domain itself is unverified, or the API
  // key is scoped to a different domain ("not authorized to send emails from").
  const msg = (error.message || '').toLowerCase()
  return (
    msg.includes('not verified') ||
    msg.includes('verify your domain') ||
    msg.includes('domain is not') ||
    msg.includes('not authorized to send emails from')
  )
}

let resendClient: Resend | null = null
function getResend(): Resend {
  if (resendClient) return resendClient
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('[email] RESEND_API_KEY is required but not set. Add it to .env.local and your deploy environment.')
  }
  resendClient = new Resend(apiKey)
  return resendClient
}

export type SendEmailResult =
  | { success: true; id: string; from: string }
  | { success: false; error: string }

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  attachments,
}: {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>
}): Promise<SendEmailResult> {
  try {
    const usePreferred = PREFERRED_FROM !== VERIFIED_FROM && Date.now() >= preferredBlockedUntil
    let from = usePreferred ? PREFERRED_FROM : VERIFIED_FROM
    const payload = {
      from,
      to,
      subject,
      html,
      replyTo: replyTo || DEFAULT_REPLY_TO,
      ...(attachments && attachments.length
        ? {
            attachments: attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              contentType: a.contentType,
            })),
          }
        : {}),
    }

    let { data, error } = await getResend().emails.send(payload)

    if (error && usePreferred && isUnverifiedDomainError(error)) {
      preferredBlockedUntil = Date.now() + RECHECK_PREFERRED_MS
      console.warn(`[email] Resend has not verified the domain for "${PREFERRED_FROM}"; sending from the verified address instead.`)
      from = VERIFIED_FROM
      ;({ data, error } = await getResend().emails.send({ ...payload, from }))
    }

    if (error) {
      console.error('[email] Resend returned error:', error)
      return { success: false, error: error.message || String(error) }
    }

    if (!data?.id) {
      console.error('[email] Resend returned no id:', data)
      return { success: false, error: 'Resend returned no message id' }
    }

    return { success: true, id: data.id, from }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] Send threw:', message)
    return { success: false, error: message }
  }
}
