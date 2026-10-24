import { memo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Flame,
  Flag,
  Gavel,
  HelpCircle,
  ListOrdered,
  OctagonAlert,
  ShieldAlert,
  ThumbsUp,
  TriangleAlert,
  Swords,
  Undo2,
  ExternalLink,
  Megaphone,
  MessagesSquare,
  UserX,
  ShieldCheck,
} from 'lucide-react'
import AgentAvatar from '../ui/AgentAvatar.jsx'
import Badge from '../ui/Badge.jsx'
import CitedText from './CitedText.jsx'
import { agentColor } from '../../lib/agentMeta.js'
import { clockTime, MESSAGE_KIND_LABELS, percent, signed } from '../../lib/format.js'
import { useReveal } from '../../lib/hooks.js'
import { useDebate } from '../../store/debateStore.js'

const ENGAGEMENT = {
  rebuttal: { icon: Swords, label: 'Rebuts' },
  agreement: { icon: Check, label: 'Agrees with' },
  accusation: { icon: ShieldAlert, label: 'Calls out' },
  concession: { icon: Undo2, label: 'Concedes to' },
  question: { icon: HelpCircle, label: 'Questions' },
  challenge: { icon: Megaphone, label: 'Confronts' },
}

const JUDGE_STYLE = {
  penalty: { icon: OctagonAlert, tone: 'danger', label: 'Penalty' },
  reprimand: { icon: Flag, tone: 'danger', label: 'Reprimand' },
  warning: { icon: TriangleAlert, tone: 'warning', label: 'Warning' },
  reward: { icon: ThumbsUp, tone: 'success', label: 'Reward' },
  instruction: { icon: Gavel, tone: 'neutral', label: 'Instruction' },
  ruling: { icon: Gavel, tone: 'cream', label: 'Ruling' },
  departure: { icon: UserX, tone: 'warning', label: 'Left the debate' },
  judge_reply: { icon: MessagesSquare, tone: 'cream', label: 'Reply to challenge' },
  conflict_report: { icon: ListOrdered, tone: 'neutral', label: 'Conflict report' },
  analysis: { icon: Gavel, tone: 'cream', label: 'Opening address' },
  convergence: { icon: Gavel, tone: 'neutral', label: 'Convergence check' },
}

const TONE_LABELS = { stern: 'Stern', angry: 'Angry', furious: 'Furious', approving: 'Approving', neutral: 'Measured' }

function Sources({ message }) {
  const evidence = useDebate((state) => state.evidence)
  const sources = message.citations.map((id) => evidence[id]).filter(Boolean)
  const [open, setOpen] = useState(false)
  if (sources.length === 0) return null
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-muted hover:text-ink flex items-center gap-1.5 text-xs font-medium"
      >
        <ShieldCheck className="size-3.5" aria-hidden />
        {sources.length} source{sources.length > 1 ? 's' : ''}
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {sources.map((source) => (
            <li key={source.id}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="bg-deep/50 hover:bg-deep/80 flex items-start gap-2 rounded-xl p-2.5 text-xs transition-colors"
              >
                <Badge tone="neutral">{source.id}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate font-semibold">{source.title}</span>
                  <span className="text-muted block truncate">{source.domain}</span>
                </span>
                <ExternalLink className="text-muted mt-0.5 size-3.5 shrink-0" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Engagements({ message }) {
  const agents = useDebate((state) => state.agents)
  if (!message.engagements?.length) return null
  return (
    <ul className="mt-3 space-y-1.5">
      {message.engagements.map((item, index) => {
        const target = agents[item.target_id]
        const entry = ENGAGEMENT[item.kind] ?? ENGAGEMENT.rebuttal
        const Icon = entry.icon
        return (
          <li key={index} className="bg-deep/40 flex items-start gap-2 rounded-xl px-3 py-2 text-xs">
            <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">
                {entry.label} <span style={{ color: agentColor(target) }}>{target?.name ?? item.target_id}</span>
              </span>
              {item.fallacy && <Badge tone="warning" className="ml-1.5">{item.fallacy}</Badge>}
              <span className="text-muted block">{item.point}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Evaluations({ message }) {
  const agents = useDebate((state) => state.agents)
  const rows = message.meta?.evaluations ?? []
  if (rows.length === 0) return null
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-xs">
        <thead className="text-muted">
          <tr>
            <th className="py-1 pr-2 font-medium">Agent</th>
            <th className="px-2 font-medium">Logic</th>
            <th className="px-2 font-medium">Evidence</th>
            <th className="px-2 font-medium">Relevance</th>
            <th className="pl-2 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.agent_id} className="border-t">
              <td className="py-1.5 pr-2 font-medium" style={{ color: agentColor(agents[row.agent_id]) }}>
                {agents[row.agent_id]?.name ?? row.agent_id}
              </td>
              <td className="px-2 tabular-nums">{row.logical_validity.toFixed(0)}/10</td>
              <td className="px-2 tabular-nums">{row.evidence_quality.toFixed(0)}/10</td>
              <td className="px-2 tabular-nums">{row.relevance.toFixed(0)}/10</td>
              <td className={`pl-2 text-right font-semibold tabular-nums ${row.score_delta < 0 ? 'text-danger' : 'text-success'}`}>
                {signed(row.score_delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConflictReport({ message }) {
  const order = message.meta?.speaking_order ?? []
  const conflicts = message.meta?.conflicts ?? []
  return (
    <div className="mt-3 space-y-2 text-xs">
      {order.length > 0 && (
        <p className="text-muted">
          <span className="text-ink font-semibold">Speaking order: </span>
          {order.map((name, index) => (
            <span key={name}>
              {index > 0 && <ArrowRight className="mx-1 inline size-3" aria-hidden />}
              {name}
            </span>
          ))}
        </p>
      )}
      {conflicts.length > 0 && (
        <ul className="space-y-1">
          {conflicts.map((conflict) => (
            <li key={conflict.id} className="flex items-start gap-2">
              <Badge tone={conflict.status === 'resolved' ? 'success' : 'warning'}>{conflict.id}</Badge>
              <span>{conflict.issue}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DebaterCard({ message, agent, animate }) {
  const text = useReveal(message.id, message.content, animate)
  const color = agentColor(agent)
  return (
    <article
      className="glass relative rounded-2xl p-4"
      style={{ borderLeft: `3px solid ${color}` }}
      aria-label={`${agent.name}, ${MESSAGE_KIND_LABELS[message.kind]}`}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <AgentAvatar agent={agent} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-tight font-semibold" style={{ color }}>
            {agent.name}
          </div>
          <div className="text-muted text-xs">
            {MESSAGE_KIND_LABELS[message.kind]}
            {message.round > 0 ? ` · round ${message.round}` : ''} · {clockTime(message.created_at)}
          </div>
        </div>
        {message.unverified && (
          <Badge tone="warning" icon={AlertTriangle} title="No verified web evidence backs this argument">
            Unverified
          </Badge>
        )}
      </header>
      <div className="text-sm" onClick={text.done ? undefined : text.skip}>
        <CitedText text={text.visible} />
        {!text.done && <span className="animate-blink bg-ink ml-0.5 inline-block h-4 w-0.5 align-middle" aria-hidden />}
      </div>
      {text.done && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {message.stance && (
            <p className="bg-deep/40 mt-3 rounded-xl px-3 py-2 text-xs">
              <span className="text-muted font-medium">Position: </span>
              {message.stance}
            </p>
          )}
          <Engagements message={message} />
          <Sources message={message} />
          {message.confidence != null && (
            <p className="text-muted mt-3 text-xs">Stated confidence {percent(message.confidence)}</p>
          )}
        </motion.div>
      )}
    </article>
  )
}

function JudgeCard({ message, agent, onOpenVerdict }) {
  const entry = JUDGE_STYLE[message.kind] ?? JUDGE_STYLE.instruction
  const Icon = entry.icon
  const agents = useDebate((state) => state.agents)
  const targets = message.targets.map((id) => agents[id]?.name).filter(Boolean)
  const severe = message.kind === 'penalty' || message.kind === 'reprimand'
  const text = useReveal(message.id, message.content, Date.now() - new Date(message.created_at).getTime() < 15000)

  if (message.kind === 'verdict') {
    return (
      <article className="bg-accent text-on-accent shadow-glow rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Gavel className="size-4" aria-hidden /> {agent.name} has reached a verdict
        </div>
        <p className="font-display mt-2 text-lg leading-snug font-semibold">{message.meta?.headline}</p>
        <button
          type="button"
          onClick={onOpenVerdict}
          className="bg-blueberry text-ink mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          Read the full verdict <ArrowRight className="size-4" aria-hidden />
        </button>
      </article>
    )
  }

  return (
    <article
      className={`glass-deep relative rounded-2xl p-4 ${
        severe ? 'border-danger/60 bg-danger/10' : entry.tone === 'warning' ? 'border-warning/60' : ''
      }`}
      style={{ borderLeft: severe ? undefined : '3px solid var(--agent-judge)' }}
      aria-label={`Judge, ${entry.label}`}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <AgentAvatar agent={agent} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-agent-judge text-sm leading-tight font-semibold">{agent.name}</div>
          <div className="text-muted text-xs">
            {targets.length > 0 && targets.length <= 2 ? `To ${targets.join(' and ')} · ` : ''}
            {message.round > 0 ? `Round ${message.round} · ` : ''}
            {clockTime(message.created_at)}
          </div>
        </div>
        <Badge tone={entry.tone} icon={Icon}>
          {entry.label}
          {message.score_delta ? ` ${signed(message.score_delta)}` : ''}
        </Badge>
        {message.tone && message.tone !== 'neutral' && (
          <Badge tone={message.tone === 'approving' ? 'success' : 'danger'} icon={message.tone === 'approving' ? ThumbsUp : Flame}>
            {TONE_LABELS[message.tone]}
          </Badge>
        )}
      </header>
      <div className="text-sm" onClick={text.done ? undefined : text.skip}>
        <CitedText text={text.visible} />
      </div>
      {text.done && message.kind === 'ruling' && <Evaluations message={message} />}
      {text.done && message.kind === 'conflict_report' && <ConflictReport message={message} />}
      {message.meta?.directive && text.done && (
        <p className="bg-deep/50 mt-3 rounded-xl px-3 py-2 text-xs">
          <span className="font-semibold">Directive: </span>
          {message.meta.directive}
        </p>
      )}
    </article>
  )
}

function ConvergenceNote({ message }) {
  const converged = message.meta?.converged
  return (
    <div className="text-muted flex items-start gap-2 px-2 text-xs" role="note">
      <Gavel className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p>
        <span className="text-ink font-semibold">{converged ? 'Debate has converged. ' : 'Debate continues. '}</span>
        {message.content}
      </p>
    </div>
  )
}

function MessageCard({ message, animate, onOpenVerdict }) {
  const agent = useDebate((state) => state.agents[message.author_id])
  if (!agent) return null
  if (message.kind === 'convergence') return <ConvergenceNote message={message} />
  return agent.role === 'judge' ? (
    <JudgeCard message={message} agent={agent} onOpenVerdict={onOpenVerdict} />
  ) : (
    <DebaterCard message={message} agent={agent} animate={animate} />
  )
}

export default memo(MessageCard)
