'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientDisplayName } from '@/lib/clientDisplay'
import { fetchReferrals, resolveReferrer, type ReferralClient } from '@/lib/referrals'

type Props = {
  clientId: string
  fullName: string
  referredBy: string | null
  referredById?: string | null
}

/** Who referred this client, and everyone this client has referred — rapport fuel before a meeting. */
export default function ClientReferralsCard({ clientId, fullName, referredBy, referredById }: Props) {
  const [referrals, setReferrals] = useState<ReferralClient[] | null>(null)
  const [referrer, setReferrer] = useState<ReferralClient | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const [list, who] = await Promise.all([
        fetchReferrals(supabase, clientId, fullName),
        resolveReferrer(supabase, { id: clientId, referred_by: referredBy, referred_by_id: referredById }),
      ])
      if (cancelled) return
      setReferrals(list)
      setReferrer(who)
    }
    load()
    return () => { cancelled = true }
  }, [clientId, fullName, referredBy, referredById])

  return (
    <div className="bg-white rounded border border-gray-med p-4" data-testid="client-referrals-card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-heading text-sm font-medium text-body flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-gold" />
          Referrals
        </h2>
        {referrals && referrals.length > 0 && (
          <span className="font-body text-xs font-semibold text-gold" data-testid="referral-count">{referrals.length} referred</span>
        )}
      </div>

      {(referredBy || referrer) && (
        <p className="font-body text-sm text-gray-dark mb-2" data-testid="referred-by-line">
          Referred by{' '}
          {referrer ? (
            <Link href={`/clients/${referrer.id}`} className="text-gold font-semibold underline underline-offset-2" data-testid="referrer-link">
              {clientDisplayName(referrer)}
            </Link>
          ) : (
            <span className="font-semibold text-body">{referredBy}</span>
          )}
        </p>
      )}

      {referrals === null ? (
        <div className="es-skeleton" style={{ height: 14, width: '60%' }} />
      ) : referrals.length === 0 ? (
        <p className="font-body text-sm text-gray-dark">No referrals yet.</p>
      ) : (
        <ul className="divide-y divide-gray-med -mx-1">
          {referrals.map((r) => (
            <li key={r.id}>
              <Link href={`/clients/${r.id}`} className="flex items-center justify-between gap-3 min-h-[44px] px-1 font-body text-sm active:bg-gray-light" data-testid="referral-row">
                <span className="font-medium truncate">{clientDisplayName(r)}</span>
                <span className="text-xs text-gray-dark flex-shrink-0">
                  {r.last_purchase_date ? `Last purchase ${new Date(`${r.last_purchase_date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : 'No purchases yet'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
