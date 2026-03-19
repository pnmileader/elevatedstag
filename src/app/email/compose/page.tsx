'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Send, Loader2, Users, User, Tag, MapPin } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'

interface ClientOption {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  billing_address: { city?: string; zip?: string } | null
  location_tags: string[] | null
}

interface Template {
  id: string
  name: string
  subject: string
  body: string
  category: string
}

function ComposeContent() {
  const searchParams = useSearchParams()
  const preselectedClient = searchParams.get('client')
  const preselectedTemplate = searchParams.get('template')

  const [clients, setClients] = useState<ClientOption[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  // Send mode
  const [sendMode, setSendMode] = useState<'single' | 'tag' | 'city' | 'zip'>('single')

  // Single mode
  const [selectedClientId, setSelectedClientId] = useState(preselectedClient || '')

  // Group mode
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedZip, setSelectedZip] = useState('')

  // Email content
  const [selectedTemplateId, setSelectedTemplateId] = useState(preselectedTemplate || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // State
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const [clientsRes, templatesRes] = await Promise.all([
        supabase.from('clients').select('id, first_name, last_name, email, phone, billing_address, location_tags').not('email', 'is', null).order('last_name'),
        fetch('/api/email/templates').then(r => r.json()),
      ])
      setClients(clientsRes.data || [])
      setTemplates(Array.isArray(templatesRes) ? templatesRes : [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // Populate template
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId)
      if (template) {
        setSubject(template.subject)
        setBody(template.body)
      }
    }
  }, [selectedTemplateId, templates])

  // Get unique tags and cities
  const uniqueTags = [...new Set(clients.flatMap(c => c.location_tags || []))].sort()
  const uniqueCities = [...new Set(clients.map(c => c.billing_address?.city?.trim()).filter(Boolean) as string[])].sort()
  const uniqueZips = [...new Set(clients.map(c => c.billing_address?.zip?.trim()).filter(Boolean) as string[])].sort()

  // Get recipients based on mode
  function getRecipients(): ClientOption[] {
    switch (sendMode) {
      case 'single':
        return clients.filter(c => c.id === selectedClientId)
      case 'tag':
        return clients.filter(c => c.location_tags?.includes(selectedTag))
      case 'city':
        return clients.filter(c => c.billing_address?.city?.trim() === selectedCity)
      case 'zip':
        return clients.filter(c => c.billing_address?.zip?.trim() === selectedZip)
      default:
        return []
    }
  }

  const recipients = getRecipients()

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (recipients.length === 0 || !subject || !body) return

    setSending(true)
    setResult(null)

    let sent = 0
    let failed = 0

    for (const client of recipients) {
      if (!client.email) continue

      // Replace template variables
      const personalizedSubject = subject
        .replace(/\{FIRST_NAME\}/g, client.first_name)
        .replace(/\{LAST_NAME\}/g, client.last_name)
      const personalizedBody = body
        .replace(/\{FIRST_NAME\}/g, client.first_name)
        .replace(/\{LAST_NAME\}/g, client.last_name)

      try {
        const response = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: client.id,
            to: client.email,
            subject: personalizedSubject,
            emailBody: personalizedBody,
            templateId: selectedTemplateId || null,
          }),
        })

        if (response.ok) {
          sent++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    setResult({
      success: failed === 0,
      message: `Sent ${sent} email${sent !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}.`
    })
    setSending(false)
  }

  if (loading) {
    return (
      <Layout currentPage="email">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#8A8A8A]" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="email">
      <div className="max-w-3xl">
        <Link href="/email" className="inline-flex items-center gap-2 text-[#8A8A8A] hover:text-[#2D2D2D] mb-6 font-body text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Email
        </Link>

        <h1 className="font-heading text-2xl font-medium text-[#2D2D2D] mb-6">Compose Email</h1>

        {result && (
          <div className={`mb-6 p-4 rounded-xl font-body text-sm ${
            result.success
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {result.message}
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-6">
          {/* Send Mode */}
          <div className="bg-white rounded-2xl border border-gray-med p-6" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <label className="block font-body font-medium text-sm mb-3">Send To</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { mode: 'single' as const, icon: <User className="w-4 h-4" />, label: 'Single Client' },
                { mode: 'tag' as const, icon: <Tag className="w-4 h-4" />, label: 'By Tag' },
                { mode: 'city' as const, icon: <MapPin className="w-4 h-4" />, label: 'By City' },
                { mode: 'zip' as const, icon: <MapPin className="w-4 h-4" />, label: 'By ZIP' },
              ].map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSendMode(mode)}
                  className={`px-4 py-2 rounded-xl font-body text-sm flex items-center gap-2 transition-colors ${
                    sendMode === mode
                      ? 'bg-[#2D2D2D] text-white'
                      : 'bg-gray-light text-gray-dark hover:bg-gray-med'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {sendMode === 'single' && (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D]"
              >
                <option value="">Select a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.last_name}, {c.first_name} ({c.email})</option>
                ))}
              </select>
            )}

            {sendMode === 'tag' && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D]"
              >
                <option value="">Select a tag...</option>
                {uniqueTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}

            {sendMode === 'city' && (
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D]"
              >
                <option value="">Select a city...</option>
                {uniqueCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            )}

            {sendMode === 'zip' && (
              <select
                value={selectedZip}
                onChange={(e) => setSelectedZip(e.target.value)}
                className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D]"
              >
                <option value="">Select a ZIP code...</option>
                {uniqueZips.map(zip => (
                  <option key={zip} value={zip}>{zip}</option>
                ))}
              </select>
            )}

            {recipients.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-gold" />
                <span className="font-body text-sm text-gray-dark">
                  {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} selected
                </span>
              </div>
            )}
          </div>

          {/* Template */}
          <div className="bg-white rounded-2xl border border-gray-med p-6" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <label className="block font-body font-medium text-sm mb-2">Template (optional)</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D]"
            >
              <option value="">No template</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="font-body text-xs text-gray-dark mt-2">
              Variables: {'{FIRST_NAME}'}, {'{LAST_NAME}'} will be replaced per recipient
            </p>
          </div>

          {/* Subject + Body */}
          <div className="bg-white rounded-2xl border border-gray-med p-6" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <div className="mb-4">
              <label className="block font-body font-medium text-sm mb-2">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="Email subject"
                className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D]"
              />
            </div>

            <div>
              <label className="block font-body font-medium text-sm mb-2">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={10}
                placeholder="Email body... Use {FIRST_NAME} and {LAST_NAME} for personalization"
                className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D] resize-y"
              />
            </div>
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={sending || recipients.length === 0 || !subject || !body}
            className="w-full bg-[#2D2D2D] hover:bg-[#404040] disabled:bg-gray-med text-white py-3 rounded-xl font-body font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}...
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#8A8A8A]" />
        </div>
      </Layout>
    }>
      <ComposeContent />
    </Suspense>
  )
}
