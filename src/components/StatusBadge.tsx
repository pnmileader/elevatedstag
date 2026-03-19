export default function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const sizeClass = size === 'sm' ? 'text-[11px]' : 'text-[12px]'

  return (
    <span className={`es-status es-status-${status} ${sizeClass}`} title={label}>
      {label}
    </span>
  )
}
