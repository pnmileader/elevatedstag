'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Send, Loader2, Users, User, Tag, MapPin, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import ClientCombobox from '@/components/ClientCombobox'
import { createClient } from '@/lib/supabase'
import { normalizeNewlines } from '@/lib/emailRender'
import { clientDisplayName } from '@/lib/clientDisplay'
import { LAST_PURCHASE_OPTIONS, lastPurchaseBucket, uniqueTags as collectTags, type LastPurchaseBucket } from '@/lib/clientFilters'

interface ClientOption {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  billing_address: { city?: string; zip?: string } | null
  city: string | null
  zip_code: string | null
  location_tags: string[] | null
  last_purchase_date: string | null
}

interface Template {
  id: string
  name: string
  subject: string
  body: string
  category: string
}

type SendMode = 'single' | 'tag' | 'city' | 'zip' | 'purchase'

const cityOf = (c: ClientOption) => (c.billing_address?.city || c.city || '').trim()
const zipOf = (c: ClientOption) => (c.billing_address?.zip || c.zip_code || '').trim()

function ComposeContent() {
  const searchParams = useSearchParams()
  const preselectedClient = searchParams.get('client')
  const preselectedTemplate = searchParams.get('template')

  const [clients, setClients] = useState<ClientOption[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const [sendMode, setSendMode] = useState<SendMode>('single')
  const [selectedClientId, setSelectedClientId] = useState(preselectedClient || '')
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedZip, setSelectedZip] = useState('')
  const [purchaseBucket, setPurchaseBucket] = useState<LastPurchaseBucket | ''>('')
  // People unchecked from the current group. Cleared whenever the group changes.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const [selectedTemplateId, setSelectedTemplateId] = useState(preselectedTemplate || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const all: ClientOption[] = []
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from('clients')
          .select('id, first_name, last_name, email, phone, billing_address, city, zip_code, location_tags, last_purchase_date')
          .not('email', 'is', null)
          .order('last_name')
          .order('id')
          .range(from, from + 999)
        all.push(...((data || []) as ClientOption[]))
        if (!data || data.length < 1000) break
      }
      const templatesRes: Template[] = await fetch('/api/email/templates').then((r) => r.json()).catch(() => [])
      const loadedTemplates = Array.isArray(templatesRes) ? templatesRes : []
      setClients(all.filter((c) => (c.email || '').includes('@')))
      setTemplates(loadedTemplates)
      // ?template=<id> deep link from the Email hub
      const prefill = loadedTemplates.find((t) => t.id === preselectedTemplate)
      if (prefill) {
        setSubject(prefill.subject)
        setBody(normalizeNewlines(prefill.body))
      }
      setLoading(false)
    }
    fetchData()
  }, [preselectedTemplate])

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId)
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setBody(normalizeNewlines(template.body))
    }
  }

  const allTags = useMemo(() => collectTags(clients.map((c) => c.location_tags)), [clients])
  const uniqueCities = useMemo(() => [...new Set(clients.map(cityOf).filter(Boolean))].sort(), [clients])
  const uniqueZips = useMemo(() => [...new Set(clients.map(zipOf).filter(Boolean))].sort(), [clients])

  // Everyone in the chosen group (before unchecking anyone)
  const group = useMemo<ClientOption[]>(() => {
    const now = new Date()
    let list: ClientOption[]
    switch (sendMode) {
      case 'single':
        return clients.filter((c) => c.id === selectedClientId)
      case 'tag':
        list = selectedTag ? clients.filter((c) => (c.location_tags || []).some((t) => t.toLowerCase() === selectedTag.toLowerCase())) : []
        break
      case 'city':
        list = selectedCity ? clients.filter((c) => cityOf(c) === selectedCity) : []
        break
      case 'zip':
        list = selectedZip ? clients.filter((c) => zipOf(c) === selectedZip) : []
        break
      case 'purchase':
        return purchaseBucket ? clients.filter((c) => lastPurchaseBucket(c.last_purchase_date, now) === purchaseBucket) : []
    }
    // Optional second filter inside a tag / city / zip group
    return purchaseBucket ? list.filter((c) => lastPurchaseBucket(c.last_purchase_date, now) === purchaseBucket) : list
  }, [clients, sendMode, selectedClientId, selectedTag, selectedCity, selectedZip, purchaseBucket])

  const recipients = useMemo(() => group.filter((c) => !excluded.has(c.id)), [group, excluded])

  const groupLabel =
    sendMode === 'tag' ? `tagged "${selectedTag}"`
    : sendMode === 'city' ? `in ${selectedCity}`
    : sendMode === 'zip' ? `in ${selectedZip}`
    : sendMode === 'purchase' ? `whose last purchase was ${(LAST_PURCHASE_OPTIONS.find((o) => o.value === purchaseBucket)?.label || '').toLowerCase()}`
    : ''

  function changeMode(mode: SendMode) {
    setSendMode(mode)
    setExcluded(new Set())
    if (mode === 'single' || mode === 'purchase') setPurchaseBucket('')
  }
  const pickGroup = (setter: (v: string) => void) => (value: string) => { setter(value); setExcluded(new Set()) }

  function toggleRecipient(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (recipients.length === 0 || !subject || !body) return

    setSending(true)
    setResult(null)
    setProgress(0)

    let sent = 0
    const failures: string[] = []
    let limitHit = false

    for (const client of recipients) {
      if (!client.email) continue
      try {
        // {FIRST_NAME}/{LAST_NAME} are filled in by the server from the client record.
        const response = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: client.id,
            to: client.email,
            subject,
            emailBody: body,
            templateId: selectedTemplateId || null,
          }),
        })
        if (response.ok) {
          sent++
        } else if (response.status === 429) {
          limitHit = true
          break
        } else {
          failures.push(clientDisplayName(client))
        }
      } catch {
        failures.push(clientDisplayName(client))
      }
      setProgress(sent + failures.length)
    }

    const notSent = recipients.length - sent - failures.length
    setResult({
      success: failures.length === 0 && !limitHit,
      message:
        `Sent ${sent} email${sent !== 1 ? 's' : ''}.` +
        (failures.length ? ` Failed: ${failures.slice(0, 5).join(', ')}${failures.length > 5 ? ` and ${failures.length - 5} more` : ''}.` : '') +
        (limitHit ? ` Hourly sending limit reached — ${notSent} recipient${notSent !== 1 ? 's were' : ' was'} not emailed. Try again in an hour.` : ''),
    })
    setSending(false)
  }

  if (loading) {
    return (
      <Layout currentPage="email">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-dark" />
        </div>
      </Layout>
    )
  }

  const modes: Array<{ mode: SendMode; icon: React.ReactNode; label: string }> = [
    { mode: 'single', icon: <User className="w-4 h-4" />, label: 'Single Client' },
    { mode: 'tag', icon: <Tag className="w-4 h-4" />, label: 'By Tag' },
    { mode: 'city', icon: <MapPin className="w-4 h-4" />, label: 'By City' },
    { mode: 'zip', icon: <MapPin className="w-4 h-4" />, label: 'By ZIP' },
    { mode: 'purchase', icon: <ShoppingBag className="w-4 h-4" />, label: 'By Last Purchase' },
  ]
  const isGroupMode = sendMode !== 'single'

  return (
    <Layout currentPage="email">
      <div className="max-w-3xl">
        <Link href="/email" className="inline-flex items-center gap-2 text-gray-dark hover:text-body mb-3 font-body text-sm min-h-[44px]">
          <ArrowLeft className="w-4 h-4" />
          Back to Email
        </Link>

        <h1 className="font-heading text-lg font-medium text-body mb-3">Compose Email</h1>

        {result && (
          <div
            role="status"
            data-testid="compose-result"
            className={`mb-3 p-4 rounded font-body text-sm ${
              result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {result.message}
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-3">
          {/* Send To */}
          <div className="bg-white rounded border border-gray-med p-5">
            <label className="block font-body font-medium text-sm mb-3">Send To</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {modes.map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={sendMode === mode}
                  onClick={() => changeMode(mode)}
                  className="es-chip"
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {sendMode === 'single' && (
              <ClientCombobox
                clients={clients}
                value={selectedClientId}
                onChange={(clientId) => setSelectedClientId(clientId)}
                placeholder="Type a client's name…"
              />
            )}

            {sendMode === 'tag' && (
              <select value={selectedTag} onChange={(e) => pickGroup(setSelectedTag)(e.target.value)} className="es-input" data-testid="group-tag" aria-label="Select a tag">
                <option value="">Select a tag…</option>
                {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            )}

            {sendMode === 'city' && (
              <select value={selectedCity} onChange={(e) => pickGroup(setSelectedCity)(e.target.value)} className="es-input" data-testid="group-city" aria-label="Select a city">
                <option value="">Select a city…</option>
                {uniqueCities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            )}

            {sendMode === 'zip' && (
              <select value={selectedZip} onChange={(e) => pickGroup(setSelectedZip)(e.target.value)} className="es-input" data-testid="group-zip" aria-label="Select a ZIP code">
                <option value="">Select a ZIP code…</option>
                {uniqueZips.map((zip) => <option key={zip} value={zip}>{zip}</option>)}
              </select>
            )}

            {isGroupMode && (
              <select
                value={purchaseBucket}
                onChange={(e) => { setPurchaseBucket(e.target.value as LastPurchaseBucket | ''); setExcluded(new Set()) }}
                className="es-input mt-2"
                data-testid="group-last-purchase"
                aria-label="Last Purchase"
              >
                <option value="">{sendMode === 'purchase' ? 'Select a last-purchase window…' : 'Last Purchase: Any'}</option>
                {LAST_PURCHASE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Last purchase: {o.label}</option>)}
              </select>
            )}

            {/* Recipient checklist — uncheck anyone who shouldn't get this email */}
            {isGroupMode && group.length > 0 && (
              <div className="mt-4" data-testid="recipient-list">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gold" />
                    <span className="font-body text-sm font-semibold" data-testid="recipient-count">
                      Sending to {recipients.length} of {group.length} client{group.length !== 1 ? 's' : ''} {groupLabel}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="es-btn-ghost min-h-[44px]" onClick={() => setExcluded(new Set())}>Select all</button>
                    <button type="button" className="es-btn-ghost min-h-[44px]" onClick={() => setExcluded(new Set(group.map((c) => c.id)))}>Select none</button>
                  </div>
                </div>
                <div className="border border-rule rounded overflow-y-auto" style={{ maxHeight: 320 }}>
                  {group.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 px-4 min-h-[48px] border-b border-rule last:border-b-0 cursor-pointer active:bg-surface-alt" data-testid="recipient-row">
                      <input
                        type="checkbox"
                        className="es-check"
                        checked={!excluded.has(c.id)}
                        onChange={() => toggleRecipient(c.id)}
                        data-testid="recipient-checkbox"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate">{clientDisplayName(c)}</span>
                        <span className="block text-xs text-ink-secondary truncate">
                          {c.email}
                          {c.last_purchase_date ? ` · last purchase ${new Date(`${c.last_purchase_date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ' · no purchases on file'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {isGroupMode && group.length === 0 && (selectedTag || selectedCity || selectedZip || purchaseBucket) && (
              <p className="mt-3 text-sm text-ink-secondary">No clients with an email address match this group.</p>
            )}
          </div>

          {/* Template */}
          <div className="bg-white rounded border border-gray-med p-5">
            <label htmlFor="compose-template" className="block font-body font-medium text-sm mb-2">Template (optional)</label>
            <select id="compose-template" value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)} className="es-input" data-testid="compose-template">
              <option value="">No template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="font-body text-xs text-gray-dark mt-2">
              {'{FIRST_NAME}'} and {'{LAST_NAME}'} are replaced with each recipient&rsquo;s name when the email is sent.
            </p>
          </div>

          {/* Subject + Body */}
          <div className="bg-white rounded border border-gray-med p-5">
            <div className="mb-4">
              <label htmlFor="compose-subject" className="block font-body font-medium text-sm mb-2">Subject</label>
              <input id="compose-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Email subject" className="es-input" />
            </div>
            <div>
              <label htmlFor="compose-body" className="block font-body font-medium text-sm mb-2">Message</label>
              <textarea
                id="compose-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={10}
                placeholder="Email body… Use {FIRST_NAME} and {LAST_NAME} for personalization"
                className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-gold resize-y"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={sending || recipients.length === 0 || !subject || !body}
            data-testid="compose-send"
            className="w-full min-h-[48px] bg-body hover:bg-body-hover disabled:bg-gray-med text-white rounded font-body font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending {progress} of {recipients.length}…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </form>
      </div>
    </Layout>
  )
}

export default function ComposePage() {
  return (
    <Suspense fallback={
      <Layout currentPage="email">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-dark" />
        </div>
      </Layout>
    }>
      <ComposeContent />
    </Suspense>
  )
}
