import { LayoutGroup, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Minus, Trophy, UserX } from 'lucide-react'
import AgentAvatar from '../ui/AgentAvatar.jsx'
import ScoreBar from '../ui/ScoreBar.jsx'
import { agentColor, STATUS_LABELS } from '../../lib/agentMeta.js'
import { signed } from '../../lib/format.js'
import { useDebate } from '../../store/debateStore.js'

function Delta({ value }) {
  if (!value) return <Minus className="text-muted size-3" aria-label="No change" />
  const up = value > 0
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold tabular-nums ${up ? 'text-success' : 'text-danger'}`}>
      <Icon className="size-3" aria-hidden />
      {signed(value, 1)}
    </span>
  )
}

export default function Scoreboard() {
  const agents = useDebate((state) => state.agents)
  const order = useDebate((state) => state.agentOrder)
  const selectedId = useDebate((state) => state.selectedAgentId)
  const select = useDebate((state) => state.selectAgent)

  const rows = order
    .map((id) => agents[id])
    .filter((agent) => agent && agent.role === 'debater')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const leaderId = rows[0]?.score != null && rows[0].score !== rows[rows.length - 1]?.score ? rows[0].id : null

  return (
    <section aria-label="Credibility scoreboard" className="glass-deep rounded-3xl p-4">
      <h2 className="text-muted mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
        <Trophy className="size-3.5" aria-hidden /> Credibility
      </h2>
      <LayoutGroup>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {rows.map((agent) => (
            <motion.li key={agent.id} layout transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
              <button
                type="button"
                onClick={() => select(selectedId === agent.id ? null : agent.id)}
                aria-pressed={selectedId === agent.id}
                className={`hover:bg-ink/10 flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors ${
                  selectedId === agent.id ? 'border-accent bg-ink/10' : 'border-transparent'
                }`}
              >
                <AgentAvatar agent={agent} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium" style={{ color: agentColor(agent) }}>
                      {agent.name}
                      {leaderId === agent.id && <Trophy className="ml-1.5 inline size-3.5" aria-label="Leading" />}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                      {agent.score != null ? Math.round(agent.score) : '–'}
                      <Delta value={agent.delta} />
                    </span>
                  </span>
                  <ScoreBar value={agent.score} color={agentColor(agent)} label={`${agent.name} credibility`} />
                  {agent.departed && (
                    <span className="text-warning mt-1 flex items-center gap-1 truncate text-[11px]">
                      <UserX className="size-3" aria-hidden /> Left the debate: {agent.leftReason}
                    </span>
                  )}
                  {agent.status !== 'idle' && (
                    <span className="text-muted mt-1 block truncate text-[11px]">
                      {agent.statusDetail || STATUS_LABELS[agent.status]}
                    </span>
                  )}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      </LayoutGroup>
    </section>
  )
}
