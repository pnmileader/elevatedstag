'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Calendar, Clock, MapPin, User } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'

interface Client {
  id: string
  first_name: string
  last_name: string
}

export default function NewAppointmentPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)

  // Form state
  const [appointmentType, setAppointmentType] = useState<'wardrobe' | 'fitting'>('wardrobe')
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [duration, setDuration] = useState('60')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    async function fetchClients() {
      const supabase = createClient()
      const { data } = await supabase
        .from('clients')
        .select('id, first_name, last_name')
        .order('last_name', { ascending: true })

      setClients(data || [])
      setLoadingClients(false)
    }

    fetchClients()

    // Set default date to today
    const today = new Date()
    setDate(today.toISOString().split('T')[0])
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Find selected client name
      const selectedClient = clients.find(c => c.id === clientId)
      const clientName = selectedClient
        ? `${selectedClient.first_name} ${selectedClient.last_name}`
        : ''

      // Build event title
      const title = appointmentType === 'wardrobe'
        ? `Wardrobe Appointment${clientName ? ` - ${clientName}` : ''}`
        : `Fitting${clientName ? ` - ${clientName}` : ''}`

      // Calculate start and end times
      const startDateTime = new Date(`${date}T${startTime}:00`)
      const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60 * 1000)

      // Build description with client link
      let description = ''
      if (clientId && selectedClient) {
        description = `Client: ${clientName}\nCRM Link: ${window.location.origin}/clients/${clientId}`
      }
      if (notes) {
        description += description ? `\n\nNotes: ${notes}` : `Notes: ${notes}`
      }

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: title,
          description,
          location,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create appointment')
      }

      // Also create an appointment record in our database
      if (clientId) {
        const supabase = createClient()
        const eventData = await response.json()

        await supabase.from('appointments').insert({
          client_id: clientId,
          google_event_id: eventData.id,
          title,
          appointment_type: appointmentType,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          location: location || null,
          notes: notes || null,
          status: 'scheduled',
        })

        // Update client's last_contact_date
        await supabase
          .from('clients')
          .update({ last_contact_date: new Date().toISOString() })
          .eq('id', clientId)
      }

      router.push('/calendar')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment')
      setSaving(false)
    }
  }

  return (
    <Layout currentPage="calendar">
      <div className="max-w-2xl">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-2 text-[#8A8A8A] hover:text-[#2D2D2D] mb-6 font-body text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Calendar
        </Link>

        <h1 className="font-heading text-2xl font-medium text-[#2D2D2D] mb-2">New Appointment</h1>
        <p className="font-body text-gray-dark mb-8">Schedule a wardrobe appointment or fitting</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 font-body">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Appointment Type */}
          <div>
            <label className="block font-body font-medium text-sm mb-3">
              Appointment Type
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAppointmentType('wardrobe')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  appointmentType === 'wardrobe'
                    ? 'border-[#2D2D2D] bg-gray-light'
                    : 'border-[#F0EEEB] hover:border-[#2D2D2D]'
                }`}
              >
                <div className="font-body font-medium">Wardrobe Appointment</div>
                <div className="font-body text-sm text-gray-dark mt-1">
                  New orders, consultations, measurements
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAppointmentType('fitting')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  appointmentType === 'fitting'
                    ? 'border-[#2D2D2D] bg-gray-light'
                    : 'border-[#F0EEEB] hover:border-[#2D2D2D]'
                }`}
              >
                <div className="font-body font-medium">Fitting</div>
                <div className="font-body text-sm text-gray-dark mt-1">
                  Try-on, adjustments, delivery
                </div>
              </button>
            </div>
          </div>

          {/* Client Selection */}
          <div>
            <label className="block font-body font-medium text-sm mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Client (Optional)
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-4 py-3 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-[#2D2D2D]"
              disabled={loadingClients}
            >
              <option value="">Select a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.last_name}, {client.first_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-body font-medium text-sm mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-4 py-3 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-[#2D2D2D]"
              />
            </div>
            <div>
              <label className="block font-body font-medium text-sm mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-4 py-3 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-[#2D2D2D]"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block font-body font-medium text-sm mb-2">
              Duration
            </label>
            <div className="flex gap-2">
              {['30', '60', '90', '120'].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDuration(mins)}
                  className={`px-4 py-2 rounded-xl font-body text-sm transition-colors ${
                    duration === mins
                      ? 'bg-[#2D2D2D] text-white'
                      : 'bg-gray-light hover:bg-gray-med text-gray-dark'
                  }`}
                >
                  {parseInt(mins) >= 60
                    ? `${parseInt(mins) / 60}${parseInt(mins) % 60 ? '.5' : ''} hr`
                    : `${mins} min`
                  }
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block font-body font-medium text-sm mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Client's office, TES Studio"
              className="w-full px-4 py-3 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-[#2D2D2D]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-body font-medium text-sm mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes for this appointment..."
              className="w-full px-4 py-3 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-[#2D2D2D] resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#2D2D2D] hover:bg-[#404040] disabled:bg-gray-med text-white py-3 rounded-xl font-body font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Appointment'
              )}
            </button>
            <Link
              href="/calendar"
              className="px-6 py-3 border border-gray-med hover:border-[#2D2D2D] rounded-xl font-body font-medium text-gray-dark transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  )
}
