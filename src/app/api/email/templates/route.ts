import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const body = await request.json()

  const { name, subject, body: templateBody, category } = body

  if (!name || !subject || !templateBody) {
    return NextResponse.json(
      { error: 'name, subject, and body are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({ name, subject, body: templateBody, category })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
