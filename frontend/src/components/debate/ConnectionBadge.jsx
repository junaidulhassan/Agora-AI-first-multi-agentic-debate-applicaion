import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import Badge from '../ui/Badge.jsx'
import { isActive, useDebate } from '../../store/debateStore.js'

export default function ConnectionBadge() {
  const connection = useDebate((state) => state.connection)
  const attempt = useDebate((state) => state.reconnectAttempt)
  const active = useDebate((state) => isActive(state.meta))
  if (!active) return null
  if (connection === 'open') {
    return (
      <Badge tone="success" icon={Wifi} role="status">
        Live
      </Badge>
    )
  }
  if (connection === 'reconnecting') {
    return (
      <Badge tone="warning" icon={RefreshCw} role="status">
        Reconnecting{attempt > 1 ? ` (attempt ${attempt})` : ''}
      </Badge>
    )
  }
  if (connection === 'missing') {
    return (
      <Badge tone="danger" icon={WifiOff} role="status">
        Debate not found
      </Badge>
    )
  }
  return (
    <Badge tone="muted" icon={RefreshCw} role="status">
      Connecting
    </Badge>
  )
}
