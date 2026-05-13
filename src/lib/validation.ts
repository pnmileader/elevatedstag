// Shared request-body schemas and a tiny parse-or-respond helper.
// Each API route imports the schema it needs and calls parseJson(request, Schema).
//
// The helper returns a discriminated result so callers stay in a single style
// across the codebase. We do not throw on validation errors — the caller turns
// the failure into a NextResponse so we keep error semantics consistent.

import { z } from 'zod'

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; issues?: z.ZodIssue[] }

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body' }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      error: 'Request body failed validation',
      issues: result.error.issues,
    }
  }
  return { ok: true, data: result.data }
}

// ===== Reusable primitives =====

const emailSchema = z.string().email().min(3).max(254)

// Allow up to 1MB of HTML body in a transactional email. Adjust if a template
// legitimately needs more. Anything dramatically larger is almost certainly
// abuse or accidental binary payload.
const htmlBodySchema = z.string().min(1).max(1_000_000)

const subjectSchema = z.string().min(1).max(998) // RFC 2822 subject line limit

const uuidLike = z.string().uuid().or(z.string().min(1).max(64))

// ===== Per-route schemas =====

export const SendEmailSchema = z.object({
  clientId: uuidLike.optional().nullable(),
  to: z.union([emailSchema, z.array(emailSchema).max(50)]),
  subject: subjectSchema,
  emailBody: htmlBodySchema,
  templateId: uuidLike.optional().nullable(),
  replyTo: emailSchema.optional(),
})
export type SendEmailInput = z.infer<typeof SendEmailSchema>

export const TestEmailSchema = z.object({
  to: emailSchema,
})
export type TestEmailInput = z.infer<typeof TestEmailSchema>

export const CreateAppointmentSchema = z.object({
  client_id: uuidLike.optional().nullable(),
  appointment_type: z.string().min(1).max(64).optional(),
  title: z.string().min(1).max(255).optional(),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  location: z.string().max(500).optional().nullable(),
  notes: z.string().max(10_000).optional().nullable(),
  status: z.string().max(64).optional(),
}).refine(
  (v) => new Date(v.end_time).getTime() > new Date(v.start_time).getTime(),
  { message: 'end_time must be after start_time', path: ['end_time'] },
)
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  subject: subjectSchema,
  body: htmlBodySchema,
  category: z.string().min(1).max(64).optional().nullable(),
})
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>

// Import routes accept open-ended row shapes (the page builds them from
// arbitrary CSV/Excel column mappings). We don't validate per-field — we
// cap row count + key count and let the route normalize.
//
// 5000 rows × 30 keys is generous for our 1180-transaction QBO export.
const importRow = z.record(
  z.string().max(64),
  z.union([z.string().max(10_000), z.number(), z.null()]),
).refine((r) => Object.keys(r).length <= 30, {
  message: 'Row has too many fields (max 30)',
})

export const ImportRowsSchema = z.object({
  rows: z.array(importRow).max(5000),
})
export type ImportRowsInput = z.infer<typeof ImportRowsSchema>
