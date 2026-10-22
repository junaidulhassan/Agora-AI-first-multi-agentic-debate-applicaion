import { ChevronRight } from 'lucide-react'
import StatusBadge from '../ui/StatusBadge.jsx'
import { timeAgo } from '../../lib/format.js'
import { navigate } from '../../lib/router.js'
import { useApp } from '../../store/appStore.js'

export default function RecentDebates() {
  const history = useApp((state) => state.history)
  const openHistory = useApp((state) => state.openHistory)
  const recent = history.slice(0, 4)
  if (recent.length === 0) return null

  return (
    <section className="w-full" aria-label="Recent debates">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-muted text-sm font-medium tracking-widest uppercase">Recent debates</h2>
        <button type="button" onClick={openHistory} className="text-muted hover:text-ink text-sm underline-offset-4 hover:underline">
          View all
        </button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {recent.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => navigate(`/debate/${item.id}`)}
              className="glass hover:bg-raised group flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{item.question}</p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  <span className="text-muted text-xs">{timeAgo(item.created_at)}</span>
                </div>
              </div>
              <ChevronRight className="text-muted size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
