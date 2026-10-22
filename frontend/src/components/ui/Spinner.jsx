import { Loader2 } from 'lucide-react'

export default function Spinner({ label = 'Loading', className = '' }) {
  return (
    <div role="status" className={`text-muted flex items-center justify-center gap-2 ${className}`}>
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}
