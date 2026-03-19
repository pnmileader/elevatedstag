import { createClient } from '@/lib/supabase'

export type ActivityType = 
  | 'client_created'
  | 'client_updated'
  | 'order_placed'
  | 'order_updated'
  | 'order_delivered'
  | 'purchase_added'
  | 'care_item_completed'
  | 'measurement_added'
  | 'note_added'

export async function logActivity({
  clientId,
  activityType,
  title,
  description,
  metadata,
}: {
  clientId: string
  activityType: ActivityType
  title: string
  description?: string
  metadata?: Record<string, any>
}) {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('activity_log')
    .insert({
      client_id: clientId,
      activity_type: activityType,
      title,
      description: description || null,
      metadata: metadata || null,
    })

  if (error) {
    console.error('Error logging activity:', error)
  }
}
