import { ChevronRight } from 'lucide-react'
import StatusBadge from '../ui/StatusBadge.jsx'
import { navigate } from '../../lib/router.js'
import { useApp } from '../../store/appStore.js'

export default function RecentDebates() {
  const history = useApp((state) => state.history)
  const openHistory = useApp((state) => state.openHistory)
  const recent = history.slice(0, 3)
  if (recent.length === 0) return null

  return (
    <section className="w-full" aria-label="Recent debates">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-muted text-xs font-semibold tracking-widest uppercase">Recent debates</h2>
        <button type="button" onClick={openHistory} className="text-muted hover:text-ink text-xs underline-offset-4 hover:underline">
          View all
        </button>
      </div>
      <ul className="space-y-1.5">
        {recent.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => navigate(`/debate/${item.id}`)}
              className="glass hover:bg-raised group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{item.question}</span>
              <StatusBadge status={item.status} />
              <ChevronRight className="text-muted size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
