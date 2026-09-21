/** transitions.dev "Number pop-in": each character rises in with a small stagger. */
export default function PopNumber({ value, className, testId }: { value: string | number; className?: string; testId?: string }) {
  const text = String(value)
  return (
    // key replays the animation whenever the value changes
    <span key={text} className={`t-digit-group is-animating ${className || ''}`} data-testid={testId} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={i} className="t-digit" aria-hidden="true" style={{ ['--d' as string]: Math.min(i, 6) }}>
          {ch}
        </span>
      ))}
    </span>
  )
}
