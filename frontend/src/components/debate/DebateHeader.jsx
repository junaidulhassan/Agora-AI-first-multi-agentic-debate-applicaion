import { useState } from 'react'
import { Square } from 'lucide-react'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import ConnectionBadge from './ConnectionBadge.jsx'
import PhaseTracker from './PhaseTracker.jsx'
import { TOPIC_BY_ID } from '../../lib/topics.js'
import { isActive, useDebate } from '../../store/debateStore.js'

export default function DebateHeader() {
  const meta = useDebate((state) => state.meta)
  const round = useDebate((state) => state.round)
  const limits = useDebate((state) => state.limits)
  const cancel = useDebate((state) => state.cancel)
  const active = useDebate(() => isActive(meta))
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (!meta) return null
  const topic = TOPIC_BY_ID[meta.topic]

  const stop = async () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 4000)
      return
    }
    setCancelling(true)
    await cancel()
    setCancelling(false)
    setConfirming(false)
  }

  return (
    <section className="glass-deep rounded-3xl p-4 sm:p-5" aria-label="Debate overview">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={meta.status} />
            {topic && (
              <Badge tone="muted" icon={topic.icon}>
                {topic.label}
              </Badge>
            )}
            {limits && active && (
              <Badge tone="muted">
                Round {round} · up to {limits.max_rounds}
              </Badge>
            )}
            <ConnectionBadge />
          </div>
          <h1 className="font-display text-xl leading-snug font-semibold text-balance sm:text-2xl">{meta.question}</h1>
        </div>
        {active && (
          <Button variant="danger" size="sm" icon={Square} loading={cancelling} onClick={stop}>
            {confirming ? 'Confirm: adjourn debate' : 'Adjourn'}
          </Button>
        )}
      </div>
      <div className="mt-4">
        <PhaseTracker />
      </div>
    </section>
  )
}
