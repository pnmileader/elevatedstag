import Link from 'next/link'
import { Ruler, Package, ShoppingBag } from 'lucide-react'

interface ClientQuickLinksProps {
  clientId: string
}

export default function ClientQuickLinks({ clientId }: ClientQuickLinksProps) {
  return (
    <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
      <h3 className="font-heading text-sm font-medium text-[#2D2D2D] mb-4">Quick Links</h3>
      <div className="space-y-3">
        <Link
          href={`/clients/${clientId}/measurements`}
          className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-light transition-colors group"
        >
          <div className="w-8 h-8 bg-gray-light rounded-lg flex items-center justify-center">
            <Ruler className="w-4 h-4 text-gold" />
          </div>
          <span className="font-body text-sm group-hover:text-[#2D2D2D] transition-colors">
            Edit Measurements
          </span>
        </Link>
        <Link
          href={`/clients/${clientId}/orders`}
          className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-light transition-colors group"
        >
          <div className="w-8 h-8 bg-gray-light rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-gold" />
          </div>
          <span className="font-body text-sm group-hover:text-[#2D2D2D] transition-colors">
            Manage Custom Orders
          </span>
        </Link>
        <Link
          href={`/clients/${clientId}/purchases`}
          className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-light transition-colors group"
        >
          <div className="w-8 h-8 bg-gray-light rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-gold" />
          </div>
          <span className="font-body text-sm group-hover:text-[#2D2D2D] transition-colors">
            Ready-Made Purchases
          </span>
        </Link>
      </div>
    </div>
  )
}
