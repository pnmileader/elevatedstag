'use client'

import { useState, useEffect } from 'react'
import { Clock, Package, CreditCard, CheckCircle, User, Ruler, ShoppingBag, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

type Activity = {
  id: string
  activity_type: string
  title: string
  description: string | null
  metadata: Record<string, any> | null
  created_at: string
}

const activityIcons: Record<string, React.ReactNode> = {
  client_created: <User className="w-4 h-4" />,
  client_updated: <User className="w-4 h-4" />,
  order_placed: <Package className="w-4 h-4" />,
  order_updated: <Package className="w-4 h-4" />,
  order_delivered: <CheckCircle className="w-4 h-4" />,
  purchase_added: <ShoppingBag className="w-4 h-4" />,
  care_item_completed: <CheckCircle className="w-4 h-4" />,
  measurement_added: <Ruler className="w-4 h-4" />,
  note_added: <CreditCard className="w-4 h-4" />,
}

const activityColors: Record<string, string> = {
  client_created: 'bg-blue-500',
  client_updated: 'bg-blue-400',
  order_placed: 'bg-gold',
  order_updated: 'bg-orange-500',
  order_delivered: 'bg-green-500',
  purchase_added: 'bg-purple-500',
  care_item_completed: 'bg-green-400',
  measurement_added: 'bg-indigo-500',
  note_added: 'bg-gray-500',
}

export default function ActivityTimeline({ clientId }: { clientId: string }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadActivities() {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error loading activities:', error)
      } else {
        setActivities(data as Activity[])
      }
      setLoading(false)
    }

    loadActivities()
  }, [clientId])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
        <h2 className="font-heading text-sm font-medium text-[#2D2D2D] mb-5">Recent Activity</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
      <h2 className="font-heading text-sm font-medium text-[#2D2D2D] mb-5">Recent Activity</h2>

      {activities.length === 0 ? (
        <p className="font-body text-sm text-gray-dark">No activity recorded yet.</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-med" />

          <div className="space-y-5">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-5 relative">
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-white ${activityColors[activity.activity_type] || 'bg-gray-500'}`}>
                  {activityIcons[activity.activity_type] || <Clock className="w-4 h-4" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-4">
                  <p className="font-body text-sm font-medium">{activity.title}</p>
                  {activity.description && (
                    <p className="font-body text-sm text-gray-dark">{activity.description}</p>
                  )}
                  <p className="font-body text-xs text-gray-dark mt-1">
                    {formatTimeAgo(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
