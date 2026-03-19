import { NextRequest, NextResponse } from 'next/server'
import { getCalendarEvents, createCalendarEvent } from '@/lib/google'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const timeMin = searchParams.get('timeMin')
  const timeMax = searchParams.get('timeMax')

  if (!timeMin || !timeMax) {
    return NextResponse.json(
      { error: 'timeMin and timeMax are required' },
      { status: 400 }
    )
  }

  try {
    const events = await getCalendarEvents(timeMin, timeMax)
    return NextResponse.json(events)
  } catch (err) {
    console.error('Error fetching calendar events:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { summary, description, location, start, end } = body

    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: 'summary, start, and end are required' },
        { status: 400 }
      )
    }

    const event = await createCalendarEvent({
      summary,
      description,
      location,
      start,
      end,
    })

    return NextResponse.json(event)
  } catch (err) {
    console.error('Error creating calendar event:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create event' },
      { status: 500 }
    )
  }
}
