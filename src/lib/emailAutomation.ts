import { createClient } from '@/lib/supabase'
import { renderTemplate } from '@/lib/gmail'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string | null
  last_contact_date: string | null
}

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
    subject: string
    body: string
  }
}

// Queue an appointment reminder email
export async function queueAppointmentReminder(appointmentId: string) {
  const supabase = createClient()

  // Get the appointment with client info
  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      id,
      title,
      start_time,
      location,
      client:clients(id, first_name, last_name, email)
    `)
    .eq('id', appointmentId)
    .single()

  const client = Array.isArray(appointment?.client) ? appointment.client[0] : appointment?.client
  if (!appointment || !client?.email) {
    console.log('No appointment or client email found')
    return
  }

  // Get active reminder rules
  const { data: rules } = await supabase
    .from('email_automation_rules')
    .select('*, template:email_templates(*)')
    .eq('trigger_type', 'appointment_reminder')
    .eq('is_active', true)

  if (!rules || rules.length === 0) {
    console.log('No active appointment reminder rules')
    return
  }

  // client already extracted above from appointment.client

  for (const rule of rules as AutomationRule[]) {
    if (!rule.template) continue

    // Calculate send time
    const appointmentTime = new Date(appointment.start_time)
    const sendTime = new Date(appointmentTime)
    sendTime.setDate(sendTime.getDate() + rule.days_offset)
    sendTime.setHours(sendTime.getHours() + rule.hours_offset)

    // Don't queue if send time is in the past
    if (sendTime < new Date()) {
      console.log('Send time is in the past, skipping')
      continue
    }

    // Check if already queued
    const { data: existing } = await supabase
      .from('email_queue')
      .select('id')
      .eq('trigger_type', 'appointment_reminder')
      .eq('trigger_reference_id', appointmentId)
      .eq('rule_id', rule.id)
      .eq('status', 'pending')
      .single()

    if (existing) {
      console.log('Email already queued for this appointment and rule')
      continue
    }

    // Render the template
    const subject = renderTemplate(rule.template.subject, {
      first_name: client.first_name,
      last_name: client.last_name,
      appointment_date: appointmentTime.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      }),
      appointment_time: appointmentTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      }),
      appointment_location: appointment.location || 'TBD',
    })

    const body = renderTemplate(rule.template.body, {
      first_name: client.first_name,
      last_name: client.last_name,
      appointment_date: appointmentTime.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      }),
      appointment_time: appointmentTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      }),
      appointment_location: appointment.location || 'TBD',
    })

    // Queue the email
    await supabase.from('email_queue').insert({
      client_id: client.id,
      template_id: rule.template.id,
      rule_id: rule.id,
      trigger_type: 'appointment_reminder',
      trigger_reference_id: appointmentId,
      to_email: client.email,
      subject,
      body,
      scheduled_for: sendTime.toISOString(),
    })

    console.log(`Queued appointment reminder for ${client.first_name} at ${sendTime}`)
  }
}

// Queue a post-delivery follow-up email
export async function queuePostDeliveryFollowUp(orderId: string) {
  const supabase = createClient()

  // Get the order with client info
  const { data: order } = await supabase
    .from('custom_orders')
    .select(`
      id,
      garment_type,
      fabric_name,
      delivered_date,
      client:clients(id, first_name, last_name, email)
    `)
    .eq('id', orderId)
    .single()

  const client = Array.isArray(order?.client) ? order.client[0] : order?.client
  if (!order || !client?.email || !order.delivered_date) {
    console.log('No order, client email, or delivery date found')
    return
  }

  // Get active post-delivery rules
  const { data: rules } = await supabase
    .from('email_automation_rules')
    .select('*, template:email_templates(*)')
    .eq('trigger_type', 'post_delivery')
    .eq('is_active', true)

  if (!rules || rules.length === 0) {
    console.log('No active post-delivery rules')
    return
  }

  // client already extracted above from order.client

  for (const rule of rules as AutomationRule[]) {
    if (!rule.template) continue

    // Calculate send time based on delivery date
    const deliveryDate = new Date(order.delivered_date)
    const sendTime = new Date(deliveryDate)
    sendTime.setDate(sendTime.getDate() + rule.days_offset)
    sendTime.setHours(9, 0, 0, 0) // Send at 9 AM

    // Don't queue if send time is in the past
    if (sendTime < new Date()) {
      console.log('Send time is in the past, skipping')
      continue
    }

    // Check if already queued
    const { data: existing } = await supabase
      .from('email_queue')
      .select('id')
      .eq('trigger_type', 'post_delivery')
      .eq('trigger_reference_id', orderId)
      .eq('rule_id', rule.id)
      .eq('status', 'pending')
      .single()

    if (existing) {
      console.log('Email already queued for this order and rule')
      continue
    }

    // Render the template
    const subject = renderTemplate(rule.template.subject, {
      first_name: client.first_name,
      last_name: client.last_name,
      garment_type: order.garment_type,
    })

    const body = renderTemplate(rule.template.body, {
      first_name: client.first_name,
      last_name: client.last_name,
      garment_type: order.garment_type,
      fabric_name: order.fabric_name || 'your custom fabric',
    })

    // Queue the email
    await supabase.from('email_queue').insert({
      client_id: client.id,
      template_id: rule.template.id,
      rule_id: rule.id,
      trigger_type: 'post_delivery',
      trigger_reference_id: orderId,
      to_email: client.email,
      subject,
      body,
      scheduled_for: sendTime.toISOString(),
    })

    console.log(`Queued post-delivery follow-up for ${client.first_name} at ${sendTime}`)
  }
}

// Check for clients needing reactivation emails
export async function checkAndQueueReactivationEmails() {
  const supabase = createClient()

  // Get active reactivation rules
  const { data: rules } = await supabase
    .from('email_automation_rules')
    .select('*, template:email_templates(*)')
    .eq('trigger_type', 'reactivation')
    .eq('is_active', true)

  if (!rules || rules.length === 0) {
    console.log('No active reactivation rules')
    return { queued: 0 }
  }

  let totalQueued = 0

  for (const rule of rules as AutomationRule[]) {
    if (!rule.template || !rule.days_inactive) continue

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - rule.days_inactive)

    // Find clients who haven't been contacted in X days
    const { data: inactiveClients } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email, last_contact_date')
      .not('email', 'is', null)
      .or(`last_contact_date.is.null,last_contact_date.lt.${cutoffDate.toISOString().split('T')[0]}`)

    if (!inactiveClients || inactiveClients.length === 0) continue

    for (const client of inactiveClients) {
      if (!client.email) continue

      // Check if we've already sent a reactivation email recently (within 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: recentEmail } = await supabase
        .from('email_queue')
        .select('id')
        .eq('client_id', client.id)
        .eq('trigger_type', 'reactivation')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .limit(1)

      if (recentEmail && recentEmail.length > 0) {
        continue // Already sent/queued a reactivation email recently
      }

      // Render the template
      const subject = renderTemplate(rule.template.subject, {
        first_name: client.first_name,
        last_name: client.last_name,
      })

      const body = renderTemplate(rule.template.body, {
        first_name: client.first_name,
        last_name: client.last_name,
      })

      // Queue for tomorrow at 9 AM
      const sendTime = new Date()
      sendTime.setDate(sendTime.getDate() + 1)
      sendTime.setHours(9, 0, 0, 0)

      // Queue the email
      await supabase.from('email_queue').insert({
        client_id: client.id,
        template_id: rule.template.id,
        rule_id: rule.id,
        trigger_type: 'reactivation',
        trigger_reference_id: client.id,
        to_email: client.email,
        subject,
        body,
        scheduled_for: sendTime.toISOString(),
      })

      totalQueued++
      console.log(`Queued reactivation email for ${client.first_name} ${client.last_name}`)
    }
  }

  return { queued: totalQueued }
}

// Cancel queued emails for a specific trigger
export async function cancelQueuedEmails(triggerType: string, triggerReferenceId: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from('email_queue')
    .update({ status: 'cancelled' })
    .eq('trigger_type', triggerType)
    .eq('trigger_reference_id', triggerReferenceId)
    .eq('status', 'pending')

  if (error) {
    console.error('Error cancelling queued emails:', error)
  }
}
