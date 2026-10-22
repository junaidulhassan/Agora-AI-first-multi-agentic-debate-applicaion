import { CircleDot, Gavel, Scale, Trophy } from 'lucide-react'
import AgentAvatar from '../ui/AgentAvatar.jsx'
import Badge from '../ui/Badge.jsx'
import ScoreBar from '../ui/ScoreBar.jsx'
import StatePanel from '../ui/StatePanel.jsx'
import { agentColor } from '../../lib/agentMeta.js'
import { signed } from '../../lib/format.js'
import { useDebate } from '../../store/debateStore.js'

const STATUS_TONE = { open: 'danger', narrowing: 'warning', resolved: 'success' }
const STATUS_LABEL = { open: 'Open', narrowing: 'Narrowing', resolved: 'Resolved' }

function Conflicts() {
  const conflicts = useDebate((state) => state.conflicts)
  const agents = useDebate((state) => state.agents)
  if (conflicts.length === 0) return null
  return (
    <section aria-label="Conflicts" className="space-y-2.5">
      <h3 className="text-muted flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
        <CircleDot className="size-3.5" aria-hidden /> Conflicts
      </h3>
      {conflicts.map((conflict) => (
        <article key={conflict.id} className="glass rounded-2xl p-3.5">
          <header className="flex items-start gap-2">
            <Badge tone="neutral">{conflict.id}</Badge>
            <p className="flex-1 text-sm font-semibold">{conflict.issue}</p>
            <Badge tone={STATUS_TONE[conflict.status]}>{STATUS_LABEL[conflict.status]}</Badge>
          </header>
          <ul className="mt-2.5 space-y-1.5">
            {Object.entries(conflict.positions).map(([agentId, claim]) => (
              <li key={agentId} className="flex items-start gap-2 text-xs">
                <AgentAvatar agent={agents[agentId]} size={20} />
                <span className="flex-1">
                  <span className="font-semibold" style={{ color: agentColor(agents[agentId]) }}>
                    {agents[agentId]?.name}
                  </span>
                  {conflict.winner === agentId && (
                    <Badge tone="cream" icon={Trophy} className="mx-1.5">
                      Ruled correct
                    </Badge>
                  )}
                  <span className="text-muted block">{claim}</span>
                </span>
              </li>
            ))}
          </ul>
          {conflict.resolution && (
            <p className="bg-deep/50 mt-2.5 flex gap-2 rounded-xl p-2.5 text-xs">
              <Gavel className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{conflict.resolution}</span>
            </p>
          )}
        </article>
      ))}
    </section>
  )
}

function Rating({ label, value }) {
  return (
    <div>
      <div className="text-muted flex justify-between text-[10px]">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(0)}/10</span>
      </div>
      <ScoreBar value={value * 10} color="var(--accent)" height={4} label={label} />
    </div>
  )
}

function Rulings() {
  const rulings = useDebate((state) => state.rulings)
  const agents = useDebate((state) => state.agents)
  if (rulings.length === 0) return null
  return (
    <section aria-label="Rulings" className="space-y-2.5">
      <h3 className="text-muted flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
        <Scale className="size-3.5" aria-hidden /> Judge's rulings
      </h3>
      {[...rulings].reverse().map((ruling) => (
        <article key={ruling.round} className="glass-deep rounded-2xl p-3.5">
          <header className="mb-2 flex items-center gap-2">
            <Badge tone="cream">{ruling.round === 0 ? 'Opening statements' : `Round ${ruling.round}`}</Badge>
          </header>
          <p className="text-sm">{ruling.summary}</p>
          <ul className="mt-3 space-y-3">
            {ruling.evaluations.map((evaluation) => {
              const agent = agents[evaluation.agent_id]
              return (
                <li key={evaluation.agent_id} className="bg-deep/40 rounded-xl p-2.5">
                  <div className="flex items-center gap-2">
                    <AgentAvatar agent={agent} size={22} />
                    <span className="flex-1 text-xs font-semibold" style={{ color: agentColor(agent) }}>
                      {agent?.name}
                    </span>
                    <span
                      className={`text-xs font-bold tabular-nums ${evaluation.score_delta < 0 ? 'text-danger' : 'text-success'}`}
                    >
                      {signed(evaluation.score_delta)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Rating label="Logic" value={evaluation.logical_validity} />
                    <Rating label="Evidence" value={evaluation.evidence_quality} />
                    <Rating label="Relevance" value={evaluation.relevance} />
                  </div>
                  {evaluation.fallacies.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {evaluation.fallacies.map((fallacy) => (
                        <Badge key={fallacy} tone="warning">
                          {fallacy}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {(evaluation.strengths || evaluation.weaknesses) && (
                    <p className="text-muted mt-2 text-xs">{evaluation.score_delta < 0 ? evaluation.weaknesses : evaluation.strengths}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </article>
      ))}
    </section>
  )
}

export default function BenchPanel() {
  const hasContent = useDebate((state) => state.conflicts.length + state.rulings.length > 0)
  return (
    <div className="scroll-thin h-full space-y-5 overflow-y-auto p-3 sm:p-4">
      {hasContent ? (
        <>
          <Conflicts />
          <Rulings />
        </>
      ) : (
        <StatePanel title="The bench is silent">Conflicts and rulings will appear after the opening statements.</StatePanel>
      )}
    </div>
  )
}
