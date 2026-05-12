'use client'

import { Suspense } from 'react'
import { CheckCircle, Loader2, Calendar, Mail, ChevronRight, Upload } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'

function SettingsContent() {
  return (
    <Layout currentPage="settings">
      <div className="max-w-3xl">
        <h1 className="font-heading text-lg font-medium text-body mb-2">Settings</h1>
        <p className="font-body text-gray-dark mb-3">Manage integrations and preferences</p>

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

        {/* Calendar — .ics invitations (no setup required) */}
        <div className="bg-white rounded p-3 border border-gray-med mb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-light rounded flex items-center justify-center">
                <Calendar className="w-6 h-6 text-body" />
              </div>
              <div>
                <h2 className="font-heading text-base font-medium text-body">
                  Calendar — tap-to-add invites
                  <CheckCircle className="inline-block w-4 h-4 ml-1 text-green-600 align-text-bottom" />
                </h2>
                <p className="font-body text-sm text-gray-dark">
                  Clients receive tap-to-add calendar invites with each appointment.
                </p>
              </div>
            </div>
          </div>
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
