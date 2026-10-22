import { Check } from 'lucide-react'
import { PHASE_LABELS, PHASE_ORDER } from '../../lib/format.js'
import { useDebate } from '../../store/debateStore.js'

export default function PhaseTracker() {
  const phase = useDebate((state) => state.phase)
  const round = useDebate((state) => state.round)
  const status = useDebate((state) => state.meta?.status)
  const finished = phase === 'completed' || status === 'completed'
  const currentIndex = finished ? PHASE_ORDER.length : PHASE_ORDER.indexOf(phase)

  return (
    <nav aria-label="Debate progress" className="scroll-thin overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1.5 text-xs">
        {PHASE_ORDER.map((key, index) => {
          const done = index < currentIndex
          const current = index === currentIndex
          return (
            <li key={key} className="flex items-center gap-1.5" aria-current={current ? 'step' : undefined}>
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-all ${
                  current
                    ? 'bg-accent text-on-accent shadow-glow border-transparent'
                    : done
                      ? 'border-line text-ink'
                      : 'border-line text-muted'
                }`}
              >
                {done && <Check className="size-3" aria-hidden />}
                {PHASE_LABELS[key]}
                {current && key === 'rebuttal' && round > 0 ? ` ${round}` : ''}
              </span>
              {index < PHASE_ORDER.length - 1 && <span className="bg-line h-px w-3" aria-hidden />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
