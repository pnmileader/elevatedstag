'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, Calendar, Mail, ChevronRight, Upload } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'

function SettingsContent() {
  const searchParams = useSearchParams()

  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(true)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)

  const googleSuccess = searchParams.get('google_connected')
  const googleError = searchParams.get('google_error')

  useEffect(() => {
    async function checkConnections() {
      const supabase = createClient()

      const { data: googleData } = await supabase
        .from('google_tokens')
        .select('email')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (googleData) {
        setGoogleConnected(true)
        setGoogleEmail(googleData.email)
      }
      setGoogleLoading(false)
    }

    checkConnections()
  }, [googleSuccess])

  return (
    <Layout currentPage="settings">
      <div className="max-w-3xl">
        <h1 className="font-heading text-lg font-medium text-body mb-2">Settings</h1>
        <p className="font-body text-gray-dark mb-3">Manage integrations and preferences</p>

        {/* Success/Error Messages */}
        {googleSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-3 font-body flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Successfully connected to Google Calendar!
          </div>
        )}
        {googleError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-3 font-body flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            Failed to connect to Google: {googleError}
          </div>
        )}

        {/* QuickBooks Integration — CSV import */}
        <Link
          href="/settings/import"
          className="block bg-white rounded p-3 border border-gray-med hover:border-body transition-colors mb-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">QB</span>
              </div>
              <div>
                <h2 className="font-heading text-base font-medium text-body">QuickBooks Online</h2>
                <p className="font-body text-sm text-gray-dark flex items-center gap-1">
                  <Upload className="w-4 h-4" />
                  Import from QuickBooks (CSV)
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-dark" />
          </div>
        </Link>

        {/* Google Calendar Integration */}
        <div className="bg-white rounded p-3 border border-gray-med mb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-heading text-base font-medium text-body">Google Calendar</h2>
                <p className="font-body text-sm text-gray-dark">
                  Sync appointments and schedule fittings
                </p>
              </div>
            </div>

            {googleLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-gray-dark" />
            ) : googleConnected ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-green-600 font-body text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </span>
              </div>
            ) : (
              <a
                href="/api/google/connect"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-body font-medium text-sm flex items-center gap-2 transition-colors"
              >
                Connect Google Calendar
              </a>
            )}
          </div>

          {googleConnected && (
            <div className="mt-4 pt-4 border-t border-gray-med">
              <p className="font-body text-sm text-gray-dark mb-3">
                Connected as: {googleEmail}
              </p>
              <a
                href="/api/google/connect"
                className="border border-gray-med hover:border-blue-500 text-gray-dark px-4 py-2 rounded font-body text-sm inline-flex items-center gap-2 transition-colors"
              >
                Reconnect
              </a>
            </div>
          )}
        </div>

        {/* Email — Resend (no setup required) */}
        <div className="bg-white rounded p-3 border border-gray-med mb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-light rounded flex items-center justify-center">
                <Mail className="w-6 h-6 text-body" />
              </div>
              <div>
                <h2 className="font-heading text-base font-medium text-body">
                  Email — connected via Resend
                  <CheckCircle className="inline-block w-4 h-4 ml-1 text-green-600 align-text-bottom" />
                </h2>
                <p className="font-body text-sm text-gray-dark">
                  Sends from katie@theelevatedstag.com. No setup required.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Trinity Workflow - Coming Soon */}
        <div className="bg-white rounded p-3 border border-gray-med opacity-60 mb-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500 rounded flex items-center justify-center">
              <span className="text-white font-bold text-lg">TW</span>
            </div>
            <div>
              <h2 className="font-heading text-base font-medium text-body">Trinity Workflow</h2>
              <p className="font-body text-sm text-gray-dark">
                Coming in Phase 3 - Sync measurements and order status
              </p>
            </div>
          </div>
        </div>

        {/* Email Automations */}
        <Link
          href="/settings/automations"
          className="block bg-white rounded p-3 border border-gray-med hover:border-body transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-light rounded flex items-center justify-center">
                <Mail className="w-6 h-6 text-body" />
              </div>
              <div>
                <h2 className="font-heading text-base font-medium text-body">Email Automations</h2>
                <p className="font-body text-sm text-gray-dark">
                  Configure automatic email sequences
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-dark" />
          </div>
        </Link>
      </div>
    </Layout>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <Layout currentPage="settings">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-dark" />
        </div>
      </Layout>
    }>
      <SettingsContent />
    </Suspense>
  )
}
