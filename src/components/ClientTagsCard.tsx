'use client'

import { useEffect, useState } from 'react'
import TagEditor from '@/components/TagEditor'
import { createClient } from '@/lib/supabase'
import { uniqueTags } from '@/lib/clientFilters'

/** Tags on the client profile — edits save immediately, no trip to the Edit screen. */
export default function ClientTagsCard({ clientId, initialTags }: { clientId: string; initialTags: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    async function loadSuggestions() {
      const supabase = createClient()
      const { data } = await supabase.from('clients').select('location_tags').not('location_tags', 'is', null).limit(1000)
      setSuggestions(uniqueTags((data || []).map((r) => r.location_tags as string[] | null)))
    }
    loadSuggestions()
  }, [])

  async function save(next: string[]) {
    const previous = tags
    setTags(next)
    setStatus('saving')
    const supabase = createClient()
    const { error } = await supabase.from('clients').update({ location_tags: next }).eq('id', clientId)
    if (error) {
      setTags(previous)
      setStatus('error')
      return
    }
    setSuggestions((s) => uniqueTags([s, next]))
    setStatus('saved')
  }

  return (
    <div className="bg-white rounded border border-gray-med p-4" data-testid="client-tags-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-sm font-medium text-body">Tags</h2>
        <span className="font-body text-xs text-gray-dark" aria-live="polite" data-testid="tags-status">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Could not save — try again' : ''}
        </span>
      </div>
      <TagEditor tags={tags} suggestions={suggestions} onChange={save} disabled={status === 'saving'} />
      <p className="font-body text-xs text-gray-dark mt-2">Use tags to group clients for filtering and group emails.</p>
    </div>
  )
}
