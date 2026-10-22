import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const ITEMS = [
  { label: 'Rebuttal', width: 3, dash: null, tint: 'agent' },
  { label: 'Agreement', width: 1.8, dash: null, tint: 'agent' },
  { label: 'Fallacy call-out', width: 3, dash: '1 6', tint: 'agent' },
  { label: 'Challenge to Judge', width: 3.2, dash: '12 3', tint: 'agent' },
  { label: 'Concession', width: 1.6, dash: '10 4 2 4', tint: 'agent' },
  { label: 'Unverified claim', width: 2, dash: '7 6', tint: 'agent' },
  { label: 'Judge ruling', width: 2.4, dash: null, tint: 'judge' },
]

export default function GraphLegend() {
  const [open, setOpen] = useState(false)
  return (
    <div className="glass-deep absolute bottom-3 left-3 z-10 rounded-2xl text-xs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-muted hover:text-ink flex items-center gap-1.5 px-3 py-2 font-medium"
      >
        Legend
        {open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronUp className="size-3.5" aria-hidden />}
      </button>
      {open && (
        <ul className="space-y-1.5 px-3 pb-3">
          {ITEMS.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <svg width="34" height="8" aria-hidden>
                <line
                  x1="1"
                  y1="4"
                  x2="33"
                  y2="4"
                  strokeLinecap="round"
                  strokeWidth={item.width}
                  strokeDasharray={item.dash ?? undefined}
                  style={{ stroke: item.tint === 'judge' ? 'var(--agent-judge)' : 'var(--agent-empiricist)' }}
                />
              </svg>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
