'use client'

import { useState, useEffect } from 'react'
import { Mail, Send, FileText, Clock, Loader2, Plus } from 'lucide-react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface Template {
  id: string
  name: string
  subject: string
  body: string
  category: string
}

interface SentEmail {
  id: string
  to_email: string
  subject: string
  sent_at: string
  client_id: string | null
  clients?: { first_name: string; last_name: string } | null
}

export default function EmailPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'compose' | 'templates' | 'sent'>('compose')

  useEffect(() => {
    async function fetchData() {
      // Fetch templates
      const templatesRes = await fetch('/api/email/templates')
      if (templatesRes.ok) {
        const data = await templatesRes.json()
        setTemplates(data)
      }

      // Fetch sent emails
      const supabase = createClient()
      const { data: emails } = await supabase
        .from('sent_emails')
        .select('*, clients(first_name, last_name)')
        .order('sent_at', { ascending: false })
        .limit(50)

      setSentEmails(emails || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  return (
    <Layout currentPage="email">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl font-medium text-[#2D2D2D]">Email</h1>
            <p className="font-body text-gray-dark">Send emails and manage templates</p>
          </div>
          <Link
            href="/email/compose"
            className="bg-[#2D2D2D] hover:bg-[#404040] text-white px-4 py-2 rounded-xl font-body font-medium text-sm inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Compose Email
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-light rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('compose')}
            className={`flex-1 px-4 py-2 rounded-xl font-body text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'compose'
                ? 'bg-white shadow-sm text-[#2D2D2D]'
                : 'text-gray-dark hover:text-[#2D2D2D]'
            }`}
          >
            <Send className="w-4 h-4" />
            Quick Send
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 px-4 py-2 rounded-xl font-body text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'templates'
                ? 'bg-white shadow-sm text-[#2D2D2D]'
                : 'text-gray-dark hover:text-[#2D2D2D]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex-1 px-4 py-2 rounded-xl font-body text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'sent'
                ? 'bg-white shadow-sm text-[#2D2D2D]'
                : 'text-gray-dark hover:text-[#2D2D2D]'
            }`}
          >
            <Clock className="w-4 h-4" />
            Sent History
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#8A8A8A]" />
          </div>
        ) : (
          <>
            {/* Quick Send Tab */}
            {activeTab === 'compose' && (
              <QuickSendForm templates={templates} />
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="bg-white rounded-2xl border border-gray-med p-6" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-body font-medium">Email Templates</h3>
                  <Link
                    href="/email/templates"
                    className="text-gold hover:text-gold-light font-body text-sm font-medium"
                  >
                    Manage Templates →
                  </Link>
                </div>
                {templates.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText className="w-12 h-12 text-gray-med mx-auto mb-4" />
                    <p className="font-body text-gray-dark mb-3">No templates yet</p>
                    <Link href="/email/templates" className="text-gold hover:text-gold-light font-body text-sm font-medium">
                      Create your first template →
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-light">
                    {templates.map(template => (
                      <div key={template.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                        <div>
                          <h4 className="font-body font-medium">{template.name}</h4>
                          <p className="font-body text-sm text-gray-dark">Subject: {template.subject}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Link href={`/email/templates`} className="text-gray-dark hover:text-[#2D2D2D] font-body text-xs">
                            Edit
                          </Link>
                          <Link href={`/email/compose?template=${template.id}`} className="text-gold hover:text-gold-light font-body text-sm font-medium">
                            Use →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sent History Tab */}
            {activeTab === 'sent' && (
              <div className="bg-white rounded-2xl border border-gray-med overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
                <div className="divide-y divide-gray-light">
                  {sentEmails.length === 0 ? (
                    <div className="p-8 text-center">
                      <Mail className="w-12 h-12 text-gray-med mx-auto mb-4" />
                      <p className="font-body text-gray-dark">No emails sent yet</p>
                    </div>
                  ) : (
                    sentEmails.map(email => (
                      <div key={email.id} className="p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-body font-medium">{email.subject}</h3>
                            <p className="font-body text-sm text-gray-dark mt-1">
                              To: {email.to_email}
                              {email.clients && (
                                <span className="ml-2 text-[#8A8A8A]">
                                  ({email.clients.first_name} {email.clients.last_name})
                                </span>
                              )}
                            </p>
                          </div>
                          <span className="font-body text-xs text-gray-dark">
                            {new Date(email.sent_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

// Quick Send Form Component
function QuickSendForm({ templates }: { templates: Template[] }) {
  const [clients, setClients] = useState<{ id: string; first_name: string; last_name: string; email: string }[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function fetchClients() {
      const supabase = createClient()
      const { data } = await supabase
        .from('clients')
        .select('id, first_name, last_name, email')
        .not('email', 'is', null)
        .order('last_name')

      setClients(data || [])
    }
    fetchClients()
  }, [])

  // When client changes, update email
  useEffect(() => {
    if (selectedClient) {
      const client = clients.find(c => c.id === selectedClient)
      if (client?.email) {
        setToEmail(client.email)
      }
    }
  }, [selectedClient, clients])

  // When template changes, populate subject and body
  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate)
      if (template) {
        let newSubject = template.subject
        let newBody = template.body

        // If client selected, replace variables
        if (selectedClient) {
          const client = clients.find(c => c.id === selectedClient)
          if (client) {
            newSubject = newSubject.replace(/\{FIRST_NAME\}/g, client.first_name)
            newBody = newBody.replace(/\{FIRST_NAME\}/g, client.first_name)
          }
        }

        setSubject(newSubject)
        setBody(newBody)
      }
    }
  }, [selectedTemplate, selectedClient, templates, clients])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setResult(null)

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient || null,
          to: toEmail,
          subject,
          emailBody: body,
          templateId: selectedTemplate || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send')
      }

      setResult({ success: true, message: 'Email sent successfully!' })

      // Reset form
      setSelectedClient('')
      setSelectedTemplate('')
      setToEmail('')
      setSubject('')
      setBody('')
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send email'
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSend} className="bg-white rounded-2xl border border-gray-med p-6 lg:p-8" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
      {result && (
        <div className={`mb-4 p-3 rounded-xl font-body text-sm ${
          result.success
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block font-body font-medium text-sm mb-2">Client</label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D]"
          >
            <option value="">Select a client...</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.last_name}, {client.first_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-body font-medium text-sm mb-2">Template</label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D]"
          >
            <option value="">Select a template...</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block font-body font-medium text-sm mb-2">To Email</label>
        <input
          type="email"
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          required
          placeholder="recipient@email.com"
          className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D]"
        />
      </div>

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

      <div className="mb-4">
        <label className="block font-body font-medium text-sm mb-2">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={8}
          placeholder="Email body..."
          className="w-full px-3 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D] resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="w-full bg-[#2D2D2D] hover:bg-[#404040] disabled:bg-gray-med text-white py-3 rounded-xl font-body font-medium flex items-center justify-center gap-2 transition-colors"
      >
        {sending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send Email
          </>
        )}
      </button>
    </form>
  )
}
