import { getValidGoogleToken } from './google'

export async function sendEmail({
  to,
  subject,
  body,
  fromName = 'Katie Fore',
  fromEmail = 'me', // 'me' uses the authenticated user's email
}: {
  to: string
  subject: string
  body: string
  fromName?: string
  fromEmail?: string
}) {
  const auth = await getValidGoogleToken()
  
  if (!auth) {
    throw new Error('Not connected to Google')
  }

  // Create the email in RFC 2822 format
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    body,
  ]
  
  const email = emailLines.join('\r\n')
  
  // Base64 encode the email (URL-safe)
  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const response = await fetch(
    'https://www.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Gmail API error:', error)
    throw new Error(`Failed to send email: ${response.status}`)
  }

  return response.json()
}

// Replace template variables with actual client data
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let rendered = template
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    rendered = rendered.replace(regex, value || '')
  }
  
  return rendered
}
