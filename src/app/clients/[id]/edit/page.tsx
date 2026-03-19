'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Trash2, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface UpcomingEvent {
  event: string
  date: string
}

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'basic' | 'personal' | 'style'>('basic')

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
    // New personal details fields
    spouse_partner: '',
    children: '',
    pets: '',
    birthday_month: '',
    communication_preference: '',
    shopping_habits: '',
    general_style: '',
    style_likes: '',
    style_dislikes: '',
    brand_preferences: '',
    // Location fields
    location_tags: '',
    // Referral & event fields
    referred_by: '',
    contact_type: 'client',
    need_by_date: '',
    need_by_description: '',
    trinity_id: '',
  })

  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([
    { event: '', date: '' },
    { event: '', date: '' },
    { event: '', date: '' },
  ])

  useEffect(() => {
    async function loadClient() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (error || !data) {
        setError('Client not found')
        setLoading(false)
        return
      }

      const address = data.billing_address || {}

      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zip: address.zip || '',
        stage: data.stage || 'lead',
        source: data.source || '',
        notes: data.notes || '',
        preferences: data.preferences || '',
        birthday: data.birthday || '',
        spouse_partner: data.spouse_partner || '',
        children: data.children || '',
        pets: data.pets || '',
        birthday_month: data.birthday_month || '',
        communication_preference: data.communication_preference || '',
        shopping_habits: data.shopping_habits || '',
        general_style: data.general_style || '',
        style_likes: data.style_likes || '',
        style_dislikes: data.style_dislikes || '',
        brand_preferences: data.brand_preferences || '',
        location_tags: Array.isArray(data.location_tags) ? data.location_tags.join(', ') : '',
        referred_by: data.referred_by || '',
        contact_type: data.contact_type || 'client',
        need_by_date: data.need_by_date || '',
        need_by_description: data.need_by_description || '',
        trinity_id: data.trinity_id || '',
      })

      if (data.upcoming_events && Array.isArray(data.upcoming_events)) {
        const events = data.upcoming_events as UpcomingEvent[]
        const padded = [...events, ...Array(3 - events.length).fill({ event: '', date: '' })].slice(0, 3)
        setUpcomingEvents(padded)
      }

      setLoading(false)
    }

    loadClient()
  }, [clientId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleEventChange = (index: number, field: 'event' | 'date', value: string) => {
    setUpcomingEvents(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError('First name and last name are required.')
      setSaving(false)
      return
    }

    const supabase = createClient()

    const hasAddress = formData.street || formData.city || formData.state || formData.zip
    const billing_address = hasAddress ? {
      street: formData.street,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
    } : null

    const filteredEvents = upcomingEvents.filter(e => e.event.trim() || e.date)
    const locationTags = formData.location_tags
      ? formData.location_tags.split(',').map(t => t.trim()).filter(Boolean)
      : null

    const { error: updateError } = await supabase
      .from('clients')
      .update({
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
        spouse_partner: formData.spouse_partner.trim() || null,
        children: formData.children.trim() || null,
        pets: formData.pets.trim() || null,
        birthday_month: formData.birthday_month || null,
        communication_preference: formData.communication_preference || null,
        shopping_habits: formData.shopping_habits || null,
        general_style: formData.general_style.trim() || null,
        style_likes: formData.style_likes.trim() || null,
        style_dislikes: formData.style_dislikes.trim() || null,
        brand_preferences: formData.brand_preferences.trim() || null,
        upcoming_events: filteredEvents.length > 0 ? filteredEvents : null,
        location_tags: locationTags,
        referred_by: formData.referred_by.trim() || null,
        contact_type: formData.contact_type,
        need_by_date: formData.need_by_date || null,
        need_by_description: formData.need_by_description.trim() || null,
        trinity_id: formData.trinity_id.trim() || null,
      })
      .eq('id', clientId)

    if (updateError) {
      console.error('Error updating client:', updateError)
      setError('Failed to update client. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/clients/${clientId}`)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client? This will also delete all their measurements, orders, and care items. This cannot be undone.')) {
      return
    }

    setDeleting(true)
    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (deleteError) {
      console.error('Error deleting client:', deleteError)
      setError('Failed to delete client. Please try again.')
      setDeleting(false)
      return
    }

    router.push('/clients')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-light flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    )
  }

  const sections = [
    { id: 'basic' as const, label: 'Basic Info' },
    { id: 'personal' as const, label: 'Personal Details' },
    { id: 'style' as const, label: 'Style & Preferences' },
  ]

  const inputClass = "w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-gold"
  const labelClass = "block font-body text-sm font-medium text-[#8A8A8A] mb-1"

  return (
    <div className="min-h-screen bg-gray-light">
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

      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-8">
        <Link href={`/clients/${clientId}`} className="inline-flex items-center gap-2 text-[#8A8A8A] hover:text-[#2D2D2D] mb-6 font-body text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Client
        </Link>

        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-[#F0EEEB]" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-heading text-xl font-medium text-[#2D2D2D]">Edit Client</h1>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-500 hover:text-red-700 font-body text-sm flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete Client'}
            </button>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1 bg-gray-light rounded-lg p-1 mb-6">
            {sections.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`flex-1 px-4 py-2 rounded-md font-body text-sm font-semibold transition-colors ${
                  activeSection === s.id
                    ? 'bg-white shadow-sm text-[#2D2D2D]'
                    : 'text-gray-dark hover:text-black'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 font-body text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* === BASIC INFO === */}
            {activeSection === 'basic' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>First Name *</label>
                    <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className={inputClass} required />
                  </div>
                  <div>
                    <label className={labelClass}>Last Name *</label>
                    <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className={inputClass} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Street Address</label>
                  <input type="text" name="street" value={formData.street} onChange={handleChange} className={inputClass} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>City</label>
                    <input type="text" name="city" value={formData.city} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>State</label>
                    <input type="text" name="state" value={formData.state} onChange={handleChange} className={inputClass} maxLength={2} />
                  </div>
                  <div>
                    <label className={labelClass}>ZIP</label>
                    <input type="text" name="zip" value={formData.zip} onChange={handleChange} className={inputClass} maxLength={10} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Client Stage</label>
                    <select name="stage" value={formData.stage} onChange={handleChange} className={`${inputClass} bg-white`}>
                      <option value="lead">Lead</option>
                      <option value="active">Active</option>
                      <option value="vip">VIP</option>
                      <option value="dormant">Dormant</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Source</label>
                    <input type="text" name="source" value={formData.source} onChange={handleChange} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Contact Type</label>
                    <select name="contact_type" value={formData.contact_type} onChange={handleChange} className={`${inputClass} bg-white`}>
                      <option value="client">Client</option>
                      <option value="referral">Referral</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Referred By</label>
                    <input type="text" name="referred_by" value={formData.referred_by} onChange={handleChange} className={inputClass} placeholder="Name of referrer" />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Birthday</label>
                  <input type="date" name="birthday" value={formData.birthday} onChange={handleChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Trinity Client ID</label>
                  <input type="text" name="trinity_id" value={formData.trinity_id} onChange={handleChange} className={inputClass} placeholder="6-digit ID (e.g., 262271)" />
                  <p className="font-body text-xs text-gray-dark mt-1">Found in Trinity URL: dealer.trinity-apparel.com/clients/XXXXXX</p>
                </div>

                <div>
                  <label className={labelClass}>Location Tags</label>
                  <input type="text" name="location_tags" value={formData.location_tags} onChange={handleChange} className={inputClass} placeholder="Austin, San Antonio, Houston (comma-separated)" />
                  <p className="font-body text-xs text-gray-dark mt-1">Used for targeted email campaigns</p>
                </div>

                <div className="pt-4 border-t border-gray-light">
                  <h3 className="font-body text-sm font-semibold text-[#2D2D2D] mb-3">Upcoming Event / Deadline</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Need By Date</label>
                      <input type="date" name="need_by_date" value={formData.need_by_date} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Description</label>
                      <input type="text" name="need_by_description" value={formData.need_by_description} onChange={handleChange} className={inputClass} placeholder="e.g., Wedding - May 15" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} />
                </div>
              </>
            )}

            {/* === PERSONAL DETAILS === */}
            {activeSection === 'personal' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Spouse / Partner</label>
                    <input type="text" name="spouse_partner" value={formData.spouse_partner} onChange={handleChange} className={inputClass} placeholder="Name" />
                  </div>
                  <div>
                    <label className={labelClass}>Birthday Month</label>
                    <select name="birthday_month" value={formData.birthday_month} onChange={handleChange} className={`${inputClass} bg-white`}>
                      <option value="">Select...</option>
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Children</label>
                  <input type="text" name="children" value={formData.children} onChange={handleChange} className={inputClass} placeholder="e.g., Jake (12), Emma (8)" />
                </div>

                <div>
                  <label className={labelClass}>Pets</label>
                  <input type="text" name="pets" value={formData.pets} onChange={handleChange} className={inputClass} placeholder="e.g., Max (Golden Retriever)" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Communication Preference</label>
                    <select name="communication_preference" value={formData.communication_preference} onChange={handleChange} className={`${inputClass} bg-white`}>
                      <option value="">Select...</option>
                      <option value="text">Text</option>
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Shopping Habits</label>
                    <select name="shopping_habits" value={formData.shopping_habits} onChange={handleChange} className={`${inputClass} bg-white`}>
                      <option value="">Select...</option>
                      <option value="seasonal">Seasonal</option>
                      <option value="as_needed">As Needed</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                {/* Upcoming Events */}
                <div>
                  <label className={labelClass}>Upcoming Events / Trips</label>
                  <div className="space-y-3">
                    {upcomingEvents.map((evt, i) => (
                      <div key={i} className="grid grid-cols-5 gap-3">
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={evt.event}
                            onChange={(e) => handleEventChange(i, 'event', e.target.value)}
                            className={inputClass}
                            placeholder={`Event ${i + 1} (e.g., Wedding in Napa)`}
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="date"
                            value={evt.date}
                            onChange={(e) => handleEventChange(i, 'date', e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* === STYLE & PREFERENCES === */}
            {activeSection === 'style' && (
              <>
                <div>
                  <label className={labelClass}>General Style Notes</label>
                  <textarea name="general_style" value={formData.general_style} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} placeholder="Overall style direction, body type considerations, etc." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Likes</label>
                    <textarea name="style_likes" value={formData.style_likes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} placeholder="Patterns, colors, fabrics they love..." />
                  </div>
                  <div>
                    <label className={labelClass}>Dislikes</label>
                    <textarea name="style_dislikes" value={formData.style_dislikes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} placeholder="Things to avoid..." />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Brand Preferences</label>
                  <textarea name="brand_preferences" value={formData.brand_preferences} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} placeholder="Preferred brands, designers, etc." />
                </div>

                <div>
                  <label className={labelClass}>Style Preferences (Legacy)</label>
                  <textarea name="preferences" value={formData.preferences} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} />
                </div>
              </>
            )}

            {/* Submit Button - Always visible */}
            <div className="flex gap-4 pt-4 border-t border-gray-light">
              <Link
                href={`/clients/${clientId}`}
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
                    Save Changes
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
