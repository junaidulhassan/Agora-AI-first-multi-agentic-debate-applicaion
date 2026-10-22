import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary:
    'bg-accent text-on-accent font-semibold shadow-glow hover:shadow-glow-lg hover:brightness-105 active:brightness-95 disabled:shadow-none disabled:opacity-50',
  secondary: 'glass text-ink hover:bg-raised disabled:opacity-50',
  inverse: 'bg-blueberry text-ink hover:bg-deep disabled:opacity-50',
  ghost: 'text-ink hover:bg-ink/10 disabled:opacity-50',
  danger: 'border border-danger/60 text-danger hover:bg-danger/15 disabled:opacity-50',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon: Icon,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center rounded-xl transition-all duration-200 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  )
}
