'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLog'

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    stage: 'lead',
    source: '',
    notes: '',
    preferences: '',
    birthday: '',
    referred_by: '',
    contact_type: 'client',
    trinity_id: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Validate required fields
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError('First name and last name are required.')
      setSaving(false)
      return
    }

    const supabase = createClient()

    // Build billing_address object if any address fields are filled
    const hasAddress = formData.street || formData.city || formData.state || formData.zip
    const billing_address = hasAddress ? {
      street: formData.street,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
    } : null

    const { data, error: insertError } = await supabase
      .from('clients')
      .insert({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        billing_address,
        stage: formData.stage,
        source: formData.source.trim() || null,
        notes: formData.notes.trim() || null,
        preferences: formData.preferences.trim() || null,
        birthday: formData.birthday || null,
        referred_by: formData.referred_by.trim() || null,
        contact_type: formData.contact_type,
        trinity_id: formData.trinity_id.trim() || null,
        first_contact_date: new Date().toISOString().split('T')[0],
        last_contact_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating client:', insertError)
      setError('Failed to create client. Please try again.')
      setSaving(false)
      return
    }

    // Log activity
    await logActivity({
      clientId: data.id,
      activityType: 'client_created',
      title: 'Client profile created',
      description: `${formData.first_name} ${formData.last_name} was added as a new client`,
    })

    // Redirect to the new client's profile
    router.push(`/clients/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-light">
      {/* Header */}
      <header className="bg-white px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-50 border-b border-[#F0EEEB]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gold rounded-full flex items-center justify-center">
            <span className="text-white font-heading font-semibold text-sm">ES</span>
          </div>
          <span className="font-heading text-[#2D2D2D] text-base font-medium tracking-wide hidden sm:block">
            THE ELEVATED STAG
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/clients" className="inline-flex items-center gap-2 text-[#8A8A8A] hover:text-[#2D2D2D] mb-6 font-body text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Link>

        <div className="bg-white rounded-2xl p-8 border border-[#F0EEEB]" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <h1 className="font-heading text-xl font-medium text-[#2D2D2D] mb-6">New Client</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 font-body text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="James"
                  required
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="Bettersworth"
                  required
                />
              </div>
            </div>

            {/* Contact Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="james@example.com"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="(512) 555-1234"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                Street Address
              </label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                placeholder="110 W Faust St"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="San Antonio"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="TX"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  ZIP
                </label>
                <input
                  type="text"
                  name="zip"
                  value={formData.zip}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="78204"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Stage and Source */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Client Stage
                </label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold bg-white"
                >
                  <option value="lead">Lead</option>
                  <option value="active">Active</option>
                  <option value="vip">VIP</option>
                  <option value="dormant">Dormant</option>
                </select>
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Source
                </label>
                <input
                  type="text"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="referral, website, event..."
                />
              </div>
            </div>

            {/* Contact Type & Referred By */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">Contact Type</label>
                <select name="contact_type" value={formData.contact_type} onChange={handleChange} className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold bg-white">
                  <option value="client">Client</option>
                  <option value="referral">Referral</option>
                </select>
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">Referred By</label>
                <input type="text" name="referred_by" value={formData.referred_by} onChange={handleChange} className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold" placeholder="Name of referrer" />
              </div>
            </div>

            {/* Birthday */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                Birthday
              </label>
              <input
                type="date"
                name="birthday"
                value={formData.birthday}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold resize-none"
                placeholder="Attorney, has 3 kids, prefers morning appointments..."
              />
            </div>

            {/* Preferences */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                Style Preferences
              </label>
              <textarea
                name="preferences"
                value={formData.preferences}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold resize-none"
                placeholder="Classic American style, prefers navy and charcoal, no pleats..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Link
                href="/clients"
                className="flex-1 px-6 py-3 border border-[#F0EEEB] rounded-xl font-body font-semibold text-gray-dark text-center hover:bg-gray-light transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#2D2D2D] hover:bg-[#404040] disabled:bg-gray-med text-white px-6 py-3 rounded-xl font-body font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Create Client
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
