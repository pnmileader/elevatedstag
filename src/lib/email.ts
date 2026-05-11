import { Resend } from 'resend'

const FROM = 'Katie Fore <katie@mail.theelevatedstag.com>'
const DEFAULT_REPLY_TO = 'katie@theelevatedstag.com'

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
  | { success: true; id: string }
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
    const payload = {
      from: FROM,
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

    const { data, error } = await getResend().emails.send(payload)

    if (error) {
      console.error('[email] Resend returned error:', error)
      return { success: false, error: error.message || String(error) }
    }

    if (!data?.id) {
      console.error('[email] Resend returned no id:', data)
      return { success: false, error: 'Resend returned no message id' }
    }

    return { success: true, id: data.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] Send threw:', message)
    return { success: false, error: message }
  }
}
