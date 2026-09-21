'use client'

import { useEffect, useState } from 'react'
import ClientCombobox, { type ComboClient } from '@/components/ClientCombobox'
import { createClient } from '@/lib/supabase'
import { clientDisplayName } from '@/lib/clientDisplay'

export type ReferredByValue = { id: string | null; name: string }

type Props = {
  value: ReferredByValue
  onChange: (next: ReferredByValue) => void
  /** The client being edited — nobody refers themselves. */
  excludeId?: string
}

/**
 * "Referred By" as a searchable list of existing clients. Picking one links the
 * two records; a referrer who isn't a client can still be typed as plain text.
 */
export default function ReferredByField({ value, onChange, excludeId }: Props) {
  const [clients, setClients] = useState<ComboClient[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const all: ComboClient[] = []
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('clients').select('id, first_name, last_name, email').order('last_name').order('id').range(from, from + 999)
        all.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      setClients(all)
    }
    load()
  }, [])

  // A saved name with no id yet (older records): show it as selected when it matches exactly one client.
  const matchedId =
    value.id ||
    (() => {
      const hits = clients.filter((c) => c.id !== excludeId && clientDisplayName(c).toLowerCase() === value.name.trim().toLowerCase())
      return hits.length === 1 ? hits[0].id : ''
    })()

  return (
    <div data-testid="referred-by">
      <ClientCombobox
        testId="referred-by-select"
        clients={clients}
        value={matchedId}
        excludeId={excludeId}
        placeholder="Search existing clients…"
        onChange={(id, client) => onChange(client ? { id, name: clientDisplayName(client) } : { id: null, name: '' })}
      />
      {!matchedId && (
        <input
          type="text"
          value={value.name}
          onChange={(e) => onChange({ id: null, name: e.target.value })}
          placeholder="…or type a name if they aren't a client"
          aria-label="Referred by (not a client)"
          data-testid="referred-by-text"
          className="es-input mt-2"
        />
      )}
    </div>
  )
}
