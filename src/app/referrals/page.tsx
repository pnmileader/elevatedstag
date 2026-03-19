'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { UserPlus, Printer, ArrowUpDown, Loader2 } from 'lucide-react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface Referral {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  referred_by: string | null
  last_contact_date: string | null
  notes: string | null
  stage: string
}

type SortField = 'name' | 'phone' | 'referred_by' | 'last_contact_date' | 'stage'
type SortDir = 'asc' | 'desc'

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const printRef = useRef<HTMLTableElement>(null)

  useEffect(() => {
    async function fetchReferrals() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone, email, referred_by, last_contact_date, notes, stage')
        .eq('contact_type', 'referral')
        .order('last_name', { ascending: true })

      if (!error && data) {
        setReferrals(data)
      }
      setLoading(false)
    }
    fetchReferrals()
  }, [])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const copy = [...referrals]
    copy.sort((a, b) => {
      let aVal: string, bVal: string
      switch (sortField) {
        case 'name': aVal = `${a.last_name} ${a.first_name}`; bVal = `${b.last_name} ${b.first_name}`; break
        case 'phone': aVal = a.phone || ''; bVal = b.phone || ''; break
        case 'referred_by': aVal = a.referred_by || ''; bVal = b.referred_by || ''; break
        case 'last_contact_date': aVal = a.last_contact_date || ''; bVal = b.last_contact_date || ''; break
        case 'stage': aVal = a.stage; bVal = b.stage; break
        default: aVal = ''; bVal = ''
      }
      const cmp = aVal.localeCompare(bVal)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [referrals, sortField, sortDir])

  function handlePrint() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const doc = printWindow.document
    const cellStyle = 'padding:6px 12px;border-bottom:1px solid #eee;font-size:13px;'
    const thStyle = 'text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#888;'

    // Set title
    doc.title = 'Referral List'

    // Style the body
    const body = doc.body
    body.style.cssText = 'font-family:Inter,system-ui,sans-serif;padding:40px;max-width:800px;margin:0 auto;'

    // Create heading
    const h1 = doc.createElement('h1')
    h1.style.cssText = 'font-size:18px;margin-bottom:4px;'
    h1.textContent = 'The Elevated Stag \u2014 Referral List'
    body.appendChild(h1)

    // Create date paragraph
    const datePara = doc.createElement('p')
    datePara.style.cssText = 'font-size:12px;color:#888;margin-bottom:24px;'
    datePara.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    body.appendChild(datePara)

    // Create table
    const table = doc.createElement('table')
    table.style.cssText = 'width:100%;border-collapse:collapse;'

    // Create thead
    const thead = doc.createElement('thead')
    const headerRow = doc.createElement('tr')
    headerRow.style.cssText = 'background:#f5f5f5;'
    const headers = ['Name', 'Phone', 'Referred By', 'Last Contact']
    headers.forEach(text => {
      const th = doc.createElement('th')
      th.style.cssText = thStyle
      th.textContent = text
      headerRow.appendChild(th)
    })
    thead.appendChild(headerRow)
    table.appendChild(thead)

    // Create tbody
    const tbody = doc.createElement('tbody')
    sorted.forEach(r => {
      const tr = doc.createElement('tr')
      const values = [
        `${r.first_name} ${r.last_name}`,
        r.phone || '\u2014',
        r.referred_by || '\u2014',
        r.last_contact_date ? new Date(r.last_contact_date).toLocaleDateString() : 'Never',
      ]
      values.forEach(val => {
        const td = doc.createElement('td')
        td.style.cssText = cellStyle
        td.textContent = val
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    body.appendChild(table)

    // Create footer
    const footer = doc.createElement('p')
    footer.style.cssText = 'font-size:10px;color:#aaa;margin-top:24px;'
    footer.textContent = `${sorted.length} referrals`
    body.appendChild(footer)

    printWindow.print()
  }

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      aria-sort={sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.05em] text-gray-dark font-medium"
    >
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-inherit font-inherit p-0"
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  )

  return (
    <Layout currentPage="referrals">
      <div className="max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="font-heading text-lg font-medium text-body">Referrals</h1>
            <p className="font-body text-gray-dark">{referrals.length} referral{referrals.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="border border-gray-med hover:border-body text-gray-dark hover:text-body px-4 py-2 rounded font-body text-sm flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Dialing Sheet
            </button>
            <Link
              href="/clients/new"
              className="bg-body hover:bg-body-hover text-white px-4 py-2 rounded font-body font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Referral
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-8 h-8 animate-spin text-gray-dark" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="bg-white rounded p-3 text-center border border-gray-med">
            <UserPlus className="w-12 h-12 text-gray-med mx-auto mb-4" />
            <h2 className="font-heading text-xl text-gray-dark mb-2">No referrals yet</h2>
            <p className="font-body text-gray-dark">Referrals will appear here when clients are marked with contact type &quot;Referral&quot;.</p>
          </div>
        ) : (
          <div className="bg-white rounded border border-gray-med overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" ref={printRef}>
                <thead className="bg-gray-light">
                  <tr>
                    <SortHeader field="name" label="Name" />
                    <SortHeader field="phone" label="Phone" />
                    <SortHeader field="referred_by" label="Referred By" />
                    <SortHeader field="last_contact_date" label="Last Contact" />
                    <SortHeader field="stage" label="Status" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(referral => (
                    <tr key={referral.id} className="border-t border-gray-med hover:bg-gray-light transition-colors">
                      <td className="px-4 py-4">
                        <Link href={`/clients/${referral.id}`} className="font-body font-medium text-body hover:text-gold">
                          {referral.first_name} {referral.last_name}
                        </Link>
                        {referral.email && (
                          <p className="font-body text-xs text-gray-dark">{referral.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 font-body text-sm">{referral.phone || '\u2014'}</td>
                      <td className="px-4 py-4 font-body text-sm">{referral.referred_by || '\u2014'}</td>
                      <td className="px-4 py-4 font-body text-sm">
                        {referral.last_contact_date
                          ? new Date(referral.last_contact_date).toLocaleDateString()
                          : <span className="text-gray-dark">Never</span>
                        }
                      </td>
                      <td className="px-4 py-4">
                        {referral.notes ? (
                          <span className="font-body text-xs text-gray-dark truncate max-w-[150px] block">{referral.notes}</span>
                        ) : (
                          <span className="text-gray-dark text-sm">{'\u2014'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
