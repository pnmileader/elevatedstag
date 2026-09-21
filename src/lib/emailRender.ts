// Pure helpers that turn what Katie types (or a stored template) into the
// subject + HTML that actually gets sent. No I/O here so it is unit-testable
// and shared by the send route, the queue processor, and the compose screens.

export type Recipient = {
  first_name?: string | null
  last_name?: string | null
}

/**
 * Seeded templates were stored with a literal backslash + "n" instead of a
 * real line break, so emails went out showing "\n\n". Accept both forms.
 */
export function normalizeNewlines(text: string): string {
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
}

/**
 * Replace {FIRST_NAME} / {LAST_NAME} (any case, also {first_name}).
 * With no recipient on file, "Hi {FIRST_NAME}," degrades to "Hi there,"
 * instead of shipping the raw placeholder to a client's inbox.
 */
export function personalize(text: string, recipient: Recipient | null | undefined): string {
  const first = (recipient?.first_name || '').trim()
  const last = (recipient?.last_name || '').trim()
  return text
    .replace(/\{\s*first[_ ]?name\s*\}/gi, first || 'there')
    .replace(/\{\s*last[_ ]?name\s*\}/gi, last)
    .replace(/\{\s*full[_ ]?name\s*\}/gi, [first, last].filter(Boolean).join(' ') || 'there')
}

const HTML_TAG = /<\/?(?:p|br|div|span|table|tr|td|ul|ol|li|a|strong|em|b|i|h[1-6]|img|html|body)\b[^>]*>/i

export function looksLikeHtml(text: string): boolean {
  return HTML_TAG.test(text)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Plain text -> HTML. Blank lines become paragraphs and single line breaks
 * become <br>, because a raw newline collapses to a space in an HTML email.
 */
export function textToHtml(text: string): string {
  const paragraphs = normalizeNewlines(text)
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1A1814;">\n${paragraphs}\n</div>`
}

export type RenderedEmail = {
  subject: string
  /** Personalized plain text (or the original HTML) — what we store in sent_emails. */
  text: string
  html: string
}

export function renderEmail(
  input: { subject: string; body: string },
  recipient: Recipient | null | undefined,
): RenderedEmail {
  const subject = personalize(normalizeNewlines(input.subject), recipient).replace(/\n+/g, ' ').trim()
  if (looksLikeHtml(input.body)) {
    const html = personalize(input.body, recipient)
    return { subject, text: html, html }
  }
  const text = personalize(normalizeNewlines(input.body), recipient)
  return { subject, text, html: textToHtml(text) }
}
