import { useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, Globe, SearchX } from 'lucide-react'
import AgentAvatar from '../ui/AgentAvatar.jsx'
import Badge from '../ui/Badge.jsx'
import StatePanel from '../ui/StatePanel.jsx'
import { agentColor } from '../../lib/agentMeta.js'
import { useDebate } from '../../store/debateStore.js'

export default function EvidencePanel() {
  const evidence = useDebate((state) => state.evidence)
  const failures = useDebate((state) => state.searchFailures)
  const agents = useDebate((state) => state.agents)
  const webSearch = useDebate((state) => state.webSearch)
  const [filter, setFilter] = useState('all')

  const items = useMemo(
    () =>
      Object.values(evidence)
        .filter((item) => filter === 'all' || item.agent_id === filter)
        .sort((a, b) => Number(b.id.slice(1)) - Number(a.id.slice(1))),
    [evidence, filter],
  )
  const contributors = [...new Set(Object.values(evidence).map((item) => item.agent_id))]

  return (
    <div className="scroll-thin h-full space-y-3 overflow-y-auto p-3 sm:p-4">
      {!webSearch && (
        <div role="alert" className="border-warning/50 bg-warning/10 flex gap-2 rounded-2xl border p-3 text-sm">
          <SearchX className="text-warning size-4 shrink-0" aria-hidden />
          <p>Web search is offline for this debate. All arguments are unverified.</p>
        </div>
      )}
      {contributors.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter evidence by agent">
          {['all', ...contributors].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === id ? 'bg-accent text-on-accent border-transparent' : 'hover:bg-ink/10'
              }`}
            >
              {id === 'all' ? 'All sources' : agents[id]?.name ?? id}
            </button>
          ))}
        </div>
      )}
      {failures.length > 0 && (
        <details className="border-warning/40 bg-warning/5 rounded-2xl border p-3 text-xs">
          <summary className="text-warning flex cursor-pointer items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" aria-hidden /> {failures.length} search{failures.length > 1 ? 'es' : ''} could not be verified
          </summary>
          <ul className="text-muted mt-2 space-y-1.5">
            {failures.map((failure, index) => (
              <li key={index}>
                <span className="text-ink font-medium">{agents[failure.agent_id]?.name}</span> searched "{failure.query}": {failure.error}
              </li>
            ))}
          </ul>
        </details>
      )}
      {items.length === 0 ? (
        <StatePanel title="No evidence yet">Sources will appear here as the agents search the web.</StatePanel>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const agent = agents[item.agent_id]
            return (
              <li key={item.id} className="glass rounded-2xl p-3.5">
                <div className="flex items-center gap-2">
                  <Badge tone="cream">{item.id}</Badge>
                  <Badge tone={item.verified ? 'success' : 'warning'} icon={item.verified ? Globe : AlertTriangle}>
                    {item.verified ? 'Verified source' : 'Unverified'}
                  </Badge>
                  <span className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: agentColor(agent) }}>
                    <AgentAvatar agent={agent} size={20} />
                    {agent?.name}
                  </span>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ink mt-2 flex items-start gap-1.5 text-sm font-semibold hover:underline"
                >
                  <span className="flex-1">{item.title}</span>
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-label="Opens in a new tab" />
                </a>
                <p className="text-muted mt-0.5 text-xs">{item.domain}</p>
                <p className="text-muted mt-2 line-clamp-4 text-xs">{item.snippet}</p>
                <p className="text-muted mt-2 text-[11px] italic">Query: {item.query}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
