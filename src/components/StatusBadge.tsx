const statusColors: Record<string, string> = {
  ordered: 'text-[#6B6560] border-[#6B6560]',
  blue_pencil: 'text-purple-700 border-purple-700',
  cutting: 'text-blue-700 border-blue-700',
  sewing: 'text-amber-700 border-amber-700',
  shipping: 'text-teal-700 border-teal-700',
  delivered: 'text-green-700 border-green-700',
}

export default function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const colors = statusColors[status] || statusColors.ordered
  const padding = size === 'sm' ? 'px-1.5 py-px' : 'px-2 py-0.5'

  return (
    <span className={`ds-status ${padding} ${colors}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
