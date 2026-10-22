import { Ban, CheckCircle2, CircleAlert, Loader2, PauseCircle } from 'lucide-react'
import Badge from './Badge.jsx'

const CONFIG = {
  pending: { tone: 'muted', icon: Loader2, label: 'Starting', spin: true },
  running: { tone: 'cream', icon: Loader2, label: 'In session', spin: true },
  completed: { tone: 'success', icon: CheckCircle2, label: 'Verdict delivered' },
  failed: { tone: 'danger', icon: CircleAlert, label: 'Failed' },
  cancelled: { tone: 'warning', icon: Ban, label: 'Adjourned' },
  interrupted: { tone: 'warning', icon: PauseCircle, label: 'Interrupted' },
}

export default function StatusBadge({ status }) {
  const entry = CONFIG[status] ?? CONFIG.pending
  const Icon = entry.icon
  return (
    <Badge tone={entry.tone}>
      <Icon className={`size-3 ${entry.spin ? 'animate-spin' : ''}`} aria-hidden />
      {entry.label}
    </Badge>
  )
}
