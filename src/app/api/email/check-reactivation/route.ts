import { NextResponse } from 'next/server'
import { checkAndQueueReactivationEmails } from '@/lib/emailAutomation'

export async function POST() {
  try {
    const result = await checkAndQueueReactivationEmails()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error checking reactivation:', error)
    return NextResponse.json({ error: 'Failed to check reactivation' }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
