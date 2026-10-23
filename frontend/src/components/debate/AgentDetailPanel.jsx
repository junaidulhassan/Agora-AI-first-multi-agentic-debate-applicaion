import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ChevronDown, Cpu, Crosshair, Quote, X } from 'lucide-react'
import AgentAvatar from '../ui/AgentAvatar.jsx'
import Badge from '../ui/Badge.jsx'
import ScoreBar from '../ui/ScoreBar.jsx'
import StatePanel from '../ui/StatePanel.jsx'
import CitedText from './CitedText.jsx'
import { agentColor, STATUS_LABELS } from '../../lib/agentMeta.js'
import { INTERACTION_LABELS, MESSAGE_KIND_LABELS, signed } from '../../lib/format.js'
import { useDebate } from '../../store/debateStore.js'

const NO_HISTORY = []

function buildThread(messages, selfId, otherId, agents) {
  const items = []
  messages.forEach((message) => {
    if (message.author_id === selfId) {
      if (agents[selfId]?.role === 'judge') {
        const targets = message.targets.filter((id) => otherId === 'all' || id === otherId)
        if (targets.length > 0) items.push({ key: message.id, dir: 'out', message, counterpart: targets[0], kind: message.kind, text: message.content })
        return
      }
      message.engagements.forEach((engagement, index) => {
        if (otherId === 'all' || engagement.target_id === otherId) {
          items.push({
            key: `${message.id}-${index}`,
            dir: 'out',
            message,
            counterpart: engagement.target_id,
            kind: engagement.kind,
            text: engagement.point,
            fallacy: engagement.fallacy,
          })
        }
      })
      return
    }
    if (otherId !== 'all' && message.author_id !== otherId) return
    if (agents[message.author_id]?.role === 'judge') {
      if (message.targets.includes(selfId)) {
        items.push({ key: message.id, dir: 'in', message, counterpart: message.author_id, kind: message.kind, text: message.content })
      }
      return
    }
    message.engagements.forEach((engagement, index) => {
      if (engagement.target_id === selfId) {
        items.push({
          key: `${message.id}-${index}`,
          dir: 'in',
          message,
          counterpart: message.author_id,
          kind: engagement.kind,
          text: engagement.point,
          fallacy: engagement.fallacy,
        })
      }
    })
  })
  return items.sort((a, b) => a.message.created_at.localeCompare(b.message.created_at))
}

function Sparkline({ points, color, label }) {
  if (points.length < 2) return <p className="text-muted text-xs">Score history appears after the first ruling.</p>
  const width = 220
  const height = 54
  const values = points.map((point) => point.score)
  const low = Math.min(...values, 0)
  const high = Math.max(...values, 100)
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * (width - 8) + 4
      const y = height - 4 - ((point.score - low) / (high - low || 1)) * (height - 8)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label={label}>
      <path d={path} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ stroke: color }} />
    </svg>
  )
}

function ThreadItem({ item, selfAgent, agents }) {
  const [open, setOpen] = useState(false)
  const counterpart = agents[item.counterpart]
  const source = item.dir === 'out' ? selfAgent : counterpart
  const target = item.dir === 'out' ? counterpart : selfAgent
  const label = INTERACTION_LABELS[item.kind] ?? MESSAGE_KIND_LABELS[item.kind] ?? item.kind
  return (
    <li className="glass-deep rounded-2xl p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold" style={{ color: agentColor(source) }}>
          {source?.name}
        </span>
        <ArrowRight className="size-3" aria-label="to" />
        <span className="font-semibold" style={{ color: agentColor(target) }}>
          {target?.name}
        </span>
        <Badge tone="muted">{label}</Badge>
        {item.fallacy && <Badge tone="warning">{item.fallacy}</Badge>}
        <span className="text-muted ml-auto">{item.message.round === 0 ? 'Opening' : `Round ${item.message.round}`}</span>
      </div>
      <p className="mt-2 text-sm">{item.text}</p>
      {agents[item.message.author_id]?.role !== 'judge' && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="text-muted hover:text-ink mt-2 flex items-center gap-1 text-xs"
          >
            Full message <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {open && (
            <div className="bg-deep/50 mt-2 rounded-xl p-3 text-sm">
              <CitedText text={item.message.content} />
            </div>
          )}
        </>
      )}
    </li>
  )
}

export default function AgentDetailPanel({ agentId, onClose }) {
  const agents = useDebate((state) => state.agents)
  const messages = useDebate((state) => state.messages)
  const history = useDebate((state) => state.scoreHistory[agentId] ?? NO_HISTORY)
  const actions = useDebate((state) => state.actions)
  const [other, setOther] = useState('all')
  const agent = agents[agentId]

  const counterparts = useMemo(
    () => Object.values(agents).filter((candidate) => candidate.id !== agentId),
    [agents, agentId],
  )
  const thread = useMemo(() => buildThread(messages, agentId, other, agents), [messages, agentId, other, agents])
  const counts = useMemo(
    () => Object.fromEntries(counterparts.map((candidate) => [candidate.id, buildThread(messages, agentId, candidate.id, agents).length])),
    [counterparts, messages, agentId, agents],
  )
  const allCount = useMemo(() => buildThread(messages, agentId, 'all', agents).length, [messages, agentId, agents])

  if (!agent) {
    return (
      <StatePanel title="Agent not found">
        <button type="button" onClick={onClose} className="underline">
          Back to feed
        </button>
      </StatePanel>
    )
  }

  const color = agentColor(agent)
  const authored = messages.filter((message) => message.author_id === agentId)
  const engagements = authored.flatMap((message) => message.engagements ?? [])
  const penalties = actions.filter((action) => action.target_id === agentId && action.score_delta < 0)
  const stats = [
    { label: 'Statements', value: authored.length },
    { label: 'Rebuttals', value: engagements.filter((item) => item.kind === 'rebuttal').length },
    { label: 'Fallacies called', value: engagements.filter((item) => item.fallacy).length },
    { label: 'Concessions', value: engagements.filter((item) => item.kind === 'concession').length },
    { label: 'Penalties', value: penalties.length },
  ]

  return (
    <motion.aside
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      aria-label={`${agent.name} details`}
      className="bg-night shadow-panel absolute inset-0 z-20 flex flex-col overflow-hidden rounded-3xl border"
    >
      <header className="flex items-start gap-3 border-b p-4">
        <AgentAvatar agent={agent} size={52} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl leading-tight font-semibold" style={{ color }}>
            {agent.name}
          </h2>
          <p className="text-muted text-sm">{agent.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={agent.status === 'idle' ? 'muted' : 'cream'}>{STATUS_LABELS[agent.status]}</Badge>
            <Badge tone="muted" icon={Cpu}>
              {agent.provider} · {agent.model}
            </Badge>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close agent details" className="hover:bg-ink/10 rounded-lg p-2">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4">
        <section aria-label="Persona" className="space-y-2.5 text-sm">
          <p className="flex gap-2">
            <Quote className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{agent.persona}</span>
          </p>
          <p>
            <span className="text-muted font-medium">Reasoning style: </span>
            {agent.reasoning_style}
          </p>
          <p>
            <span className="text-muted font-medium">Bias: </span>
            {agent.bias}
          </p>
          {agent.fight_style && (
            <p>
              <span className="text-muted font-medium">Fighting style: </span>
              {agent.fight_style}
            </p>
          )}
          {agent.focus && (
            <p className="flex gap-2">
              <Crosshair className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="text-muted font-medium">Assigned focus: </span>
                {agent.focus}
              </span>
            </p>
          )}
        </section>

        {agent.role === 'debater' && (
          <section aria-label="Credibility" className="glass-deep rounded-2xl p-3.5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-muted text-xs font-semibold tracking-widest uppercase">Credibility</h3>
              <span className="text-2xl font-semibold tabular-nums">
                {agent.score != null ? Math.round(agent.score) : '–'}
                <span className="text-muted text-sm"> / 100</span>
                {agent.delta ? (
                  <span className={`ml-2 text-sm ${agent.delta > 0 ? 'text-success' : 'text-danger'}`}>{signed(agent.delta, 1)}</span>
                ) : null}
              </span>
            </div>
            <div className="mt-2">
              <ScoreBar value={agent.score} color={color} height={10} label={`${agent.name} credibility`} />
            </div>
            <div className="mt-3">
              <Sparkline points={history} color={color} label={`${agent.name} score over rounds`} />
            </div>
            {agent.reason && <p className="text-muted mt-2 text-xs italic">Latest: {agent.reason}</p>}
            <dl className="mt-3 grid grid-cols-5 gap-1 text-center">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-deep/40 rounded-xl px-1 py-2">
                  <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
                  <dt className="text-muted text-[10px] leading-tight">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section aria-label="Communication history">
          <h3 className="text-muted mb-2 text-xs font-semibold tracking-widest uppercase">Communication history</h3>
          <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2" role="group" aria-label="Filter by counterpart">
            <button
              type="button"
              onClick={() => setOther('all')}
              aria-pressed={other === 'all'}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${other === 'all' ? 'bg-accent text-on-accent border-transparent' : 'hover:bg-ink/10'}`}
            >
              Everyone ({allCount})
            </button>
            {counterparts.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setOther(candidate.id)}
                aria-pressed={other === candidate.id}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-xs font-medium ${
                  other === candidate.id ? 'bg-accent text-on-accent border-transparent' : 'hover:bg-ink/10'
                }`}
              >
                <AgentAvatar agent={candidate} size={20} />
                {candidate.name.replace(/^The /, '')} ({counts[candidate.id]})
              </button>
            ))}
          </div>
          {thread.length === 0 ? (
            <p className="text-muted glass-deep rounded-2xl p-4 text-center text-sm">
              No exchanges {other === 'all' ? '' : `with ${agents[other]?.name} `}yet.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {thread.map((item) => (
                <ThreadItem key={item.key} item={item} selfAgent={agent} agents={agents} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </motion.aside>
  )
}
