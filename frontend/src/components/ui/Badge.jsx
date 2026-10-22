const TONES = {
  neutral: 'border-line bg-ink/5 text-ink',
  muted: 'border-line bg-transparent text-muted',
  cream: 'border-transparent bg-accent text-on-accent',
  success: 'border-success/50 bg-success/10 text-success',
  warning: 'border-warning/50 bg-warning/10 text-warning',
  danger: 'border-danger/50 bg-danger/10 text-danger',
}

export default function Badge({ tone = 'neutral', icon: Icon, children, className = '', ...props }) {
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden />}
      {children}
    </span>
  )
}
