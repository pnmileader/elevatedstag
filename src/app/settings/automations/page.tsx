'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Mail,
  Clock,
  Calendar,
  UserX,
  Gift,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'

interface AutomationRule {
  id: string
  name: string
  trigger_type: string
  template_id: string | null
  days_offset: number
  hours_offset: number
  days_inactive: number | null
  is_active: boolean
  template?: {
    id: string
    name: string
    subject: string
  } | null
}

interface QueuedEmail {
  id: string
  trigger_type: string
  to_email: string
  subject: string
  scheduled_for: string
  status: string
  client?: {
    first_name: string
    last_name: string
  }
}

interface Template {
  id: string
  name: string
  subject: string
}

const triggerTypeConfig: Record<string, {
  icon: React.ReactNode
  label: string
  description: string
  color: string
}> = {
  appointment_reminder: {
    icon: <Calendar className="w-5 h-5" />,
    label: 'Appointment Reminder',
    description: 'Send before scheduled appointments',
    color: 'text-blue-500 bg-blue-50',
  },
  post_delivery: {
    icon: <Mail className="w-5 h-5" />,
    label: 'Post-Delivery Follow Up',
    description: 'Send after order is delivered',
    color: 'text-green-500 bg-green-50',
  },
  reactivation: {
    icon: <UserX className="w-5 h-5" />,
    label: 'Reactivation',
    description: 'Re-engage inactive clients',
    color: 'text-orange-500 bg-orange-50',
  },
  birthday: {
    icon: <Gift className="w-5 h-5" />,
    label: 'Birthday',
    description: 'Send on client birthdays',
    color: 'text-purple-500 bg-purple-50',
  },
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [queuedEmails, setQueuedEmails] = useState<QueuedEmail[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [checkingReactivation, setCheckingReactivation] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const supabase = createClient()

    const [rulesRes, queueRes, templatesRes] = await Promise.all([
      supabase
        .from('email_automation_rules')
        .select('*, template:email_templates(id, name, subject)')
        .order('trigger_type'),
      supabase
        .from('email_queue')
        .select('*, client:clients(first_name, last_name)')
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })
        .limit(10),
      supabase
        .from('email_templates')
        .select('id, name, subject')
        .eq('is_active', true),
    ])

    setRules(rulesRes.data || [])
    setQueuedEmails(queueRes.data || [])
    setTemplates(templatesRes.data || [])
    setLoading(false)
  }

  async function toggleRule(ruleId: string, isActive: boolean) {
    const supabase = createClient()

    await supabase
      .from('email_automation_rules')
      .update({ is_active: !isActive })
      .eq('id', ruleId)

    setRules(rules.map(r =>
      r.id === ruleId ? { ...r, is_active: !isActive } : r
    ))
  }

  async function updateRuleTemplate(ruleId: string, templateId: string | null) {
    const supabase = createClient()

    await supabase
      .from('email_automation_rules')
      .update({ template_id: templateId })
      .eq('id', ruleId)

    fetchData() // Refresh to get updated template info
  }

  async function processQueue() {
    setProcessing(true)
    try {
      const res = await fetch('/api/email/process-queue', { method: 'POST' })
      const data = await res.json()
      alert(`Processed: ${data.sent || 0} sent, ${data.failed || 0} failed`)
      fetchData()
    } catch (error) {
      console.error('Error processing queue:', error)
      alert('Failed to process queue')
    }
    setProcessing(false)
  }

  async function checkReactivation() {
    setCheckingReactivation(true)
    try {
      const res = await fetch('/api/email/check-reactivation', { method: 'POST' })
      const data = await res.json()
      alert(`Queued ${data.queued || 0} reactivation emails`)
      fetchData()
    } catch (error) {
      console.error('Error checking reactivation:', error)
      alert('Failed to check reactivation')
    }
    setCheckingReactivation(false)
  }

  async function cancelQueuedEmail(emailId: string) {
    if (!confirm('Cancel this scheduled email?')) return

    const supabase = createClient()
    await supabase
      .from('email_queue')
      .update({ status: 'cancelled' })
      .eq('id', emailId)

    fetchData()
  }

  if (loading) {
    return (
      <Layout currentPage="settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#8A8A8A]" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="settings">
      <div className="max-w-4xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-[#8A8A8A] hover:text-[#2D2D2D] mb-6 font-body text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-2xl font-medium text-[#2D2D2D]">Email Automations</h1>
            <p className="font-body text-gray-dark mt-1">
              Configure automatic email sequences
            </p>
          </div>
        </div>

        {/* Automation Rules */}
        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med mb-8" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <h2 className="font-heading text-base font-medium text-[#2D2D2D] mb-6">Automation Rules</h2>

          <div className="space-y-4">
            {rules.map(rule => {
              const config = triggerTypeConfig[rule.trigger_type] || triggerTypeConfig.appointment_reminder

              return (
                <div
                  key={rule.id}
                  className={`p-5 rounded-2xl border-2 transition-colors ${
                    rule.is_active ? 'border-[#2D2D2D] bg-gray-light/30' : 'border-gray-med bg-gray-light'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.color}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-body font-medium text-lg">{rule.name}</h3>
                        <p className="font-body text-sm text-gray-dark mt-1">{config.description}</p>

                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          {/* Timing Info */}
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-gray-dark" />
                            <span className="font-body text-gray-dark">
                              {rule.trigger_type === 'reactivation'
                                ? `After ${rule.days_inactive} days inactive`
                                : rule.days_offset < 0 || rule.hours_offset < 0
                                  ? `${Math.abs(rule.days_offset * 24 + rule.hours_offset)} hours before`
                                  : `${rule.days_offset} days after`
                              }
                            </span>
                          </div>

                          {/* Template Selector */}
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-dark" />
                            <select
                              value={rule.template_id || ''}
                              onChange={(e) => updateRuleTemplate(rule.id, e.target.value || null)}
                              className="px-3 py-1 border border-[#F0EEEB] rounded-xl font-body text-sm bg-white focus:outline-none focus:border-[#2D2D2D]"
                            >
                              <option value="">No template</option>
                              {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => toggleRule(rule.id, rule.is_active)}
                      className={`px-4 py-2 rounded-xl font-body text-sm font-medium flex items-center gap-2 transition-colors ${
                        rule.is_active
                          ? 'bg-[#2D2D2D] text-white hover:bg-[#404040]'
                          : 'bg-gray-med text-gray-dark hover:bg-gray-dark hover:text-white'
                      }`}
                    >
                      {rule.is_active ? (
                        <>
                          <Pause className="w-4 h-4" />
                          Active
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Paused
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Manual Actions */}
        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med mb-8" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <h2 className="font-heading text-base font-medium text-[#2D2D2D] mb-6">Manual Actions</h2>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={processQueue}
              disabled={processing}
              className="px-6 py-3 bg-[#2D2D2D] hover:bg-[#404040] disabled:bg-gray-med text-white rounded-xl font-body font-medium flex items-center gap-2"
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              Process Email Queue
            </button>

            <button
              onClick={checkReactivation}
              disabled={checkingReactivation}
              className="px-6 py-3 border-2 border-[#2D2D2D] text-[#2D2D2D] hover:bg-gray-light rounded-xl font-body font-medium flex items-center gap-2"
            >
              {checkingReactivation ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <UserX className="w-5 h-5" />
              )}
              Check Reactivation
            </button>
          </div>
        </div>

        {/* Queued Emails */}
        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-base font-medium text-[#2D2D2D]">Email Queue</h2>
            <span className="bg-gray-light text-[#8A8A8A] px-3 py-1 rounded-full font-body text-sm font-medium">
              {queuedEmails.length} pending
            </span>
          </div>

          {queuedEmails.length === 0 ? (
            <p className="font-body text-gray-dark py-4">No emails in queue</p>
          ) : (
            <div className="space-y-3">
              {queuedEmails.map(email => {
                const config = triggerTypeConfig[email.trigger_type] || triggerTypeConfig.appointment_reminder

                return (
                  <div
                    key={email.id}
                    className="flex items-center justify-between p-4 bg-gray-light rounded-2xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.color}`}>
                        {config.icon}
                      </div>
                      <div>
                        <p className="font-body font-medium">
                          {email.client?.first_name} {email.client?.last_name}
                        </p>
                        <p className="font-body text-sm text-gray-dark">{email.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-body text-sm font-medium">
                          {new Date(email.scheduled_for).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="font-body text-xs text-gray-dark">
                          {new Date(email.scheduled_for).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => cancelQueuedEmail(email.id)}
                        className="text-red-500 hover:text-red-700 font-body text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
