import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  CircleHelp,
  Clipboard,
  Gavel,
  Loader2,
  Plus,
  ShieldX,
  ThumbsUp,
  Trophy,
} from 'lucide-react'
import AgentAvatar from '../ui/AgentAvatar.jsx'
import Button from '../ui/Button.jsx'
import StatePanel from '../ui/StatePanel.jsx'
import CitedText, { CitationChip } from './CitedText.jsx'
import { agentColor } from '../../lib/agentMeta.js'
import { percent } from '../../lib/format.js'
import { navigate } from '../../lib/router.js'
import { isActive, useDebate } from '../../store/debateStore.js'

const CONSENSUS = {
  unanimous: 'Unanimous',
  strong: 'Strong consensus',
  partial: 'Partial consensus',
  contested: 'Contested',
  unresolved: 'Unresolved',
}

function AgentChip({ agentId }) {
  const agent = useDebate((state) => state.agents[agentId])
  if (!agent) return null
  return (
    <span className="inline-flex items-center gap-2">
      <AgentAvatar agent={agent} size={24} />
      <span className="text-on-accent text-sm font-semibold">{agent.name}</span>
    </span>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="mt-6">
      <h3 className="text-on-accent/75 mb-2.5 flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
        <Icon className="size-4" aria-hidden /> {title}
      </h3>
      {children}
    </section>
  )
}

function buildSummary(verdict) {
  return [
    `Question: ${verdict.question}`,
    `Verdict: ${verdict.headline}`,
    '',
    verdict.answer,
    '',
    `Confidence: ${percent(verdict.confidence)} (${CONSENSUS[verdict.consensus]})`,
    '',
    'Remaining uncertainty:',
    ...verdict.remaining_uncertainty.map((item) => `- ${item}`),
    '',
    verdict.debate_summary,
    '',
    'Agora: Where AI argues before it answers',
  ].join('\n')
}

function Pending() {
  const meta = useDebate((state) => state.meta)
  const failure = useDebate((state) => state.failure)
  const convergence = useDebate((state) => state.convergence)
  const round = useDebate((state) => state.round)
  const limits = useDebate((state) => state.limits)
  const active = isActive(meta)

  if (failure) {
    return (
      <div className="p-4">
        <StatePanel
          tone="error"
          title="The debate could not be completed"
          action={
            <Button variant="primary" icon={Plus} onClick={() => navigate('/')}>
              Start a new debate
            </Button>
          }
        >
          <p>{failure.message}</p>
          {failure.details?.key_variable && (
            <p className="mt-2">
              Check <strong>{failure.details.key_variable}</strong> in your .env file.
            </p>
          )}
        </StatePanel>
      </div>
    )
  }
  if (!active) {
    return (
      <div className="p-4">
        <StatePanel title="No verdict was reached">
          {meta?.status === 'cancelled'
            ? 'This debate was adjourned before the Judge could rule.'
            : meta?.error ?? 'This debate ended before a verdict.'}
        </StatePanel>
      </div>
    )
  }
  return (
    <div className="p-4">
      <div className="glass-deep flex flex-col items-center gap-3 rounded-3xl p-8 text-center">
        <Gavel className="text-agent-judge size-10 animate-pulse" aria-hidden />
        <h3 className="font-display text-xl font-semibold">The Judge is withholding the verdict</h3>
        <p className="text-muted max-w-sm text-sm">
          No answer is given until the panel has argued, been cross-examined, and the debate has converged.
        </p>
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Round {round}
          {limits ? ` of up to ${limits.max_rounds}` : ''}
          {convergence && !convergence.converged ? ` · consensus ${percent(convergence.consensus_level)}` : ''}
        </p>
      </div>
    </div>
  )
}

export default function VerdictView() {
  const verdict = useDebate((state) => state.verdict)
  const evidence = useDebate((state) => state.evidence)
  const [copied, setCopied] = useState(false)

  if (!verdict) return <Pending />

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildSummary(verdict))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto p-3 sm:p-4">
      <motion.article
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-accent text-on-accent shadow-glow-lg rounded-3xl p-5 sm:p-7"
        aria-label="Final verdict"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-widest uppercase">
          <Gavel className="size-4" aria-hidden /> Final verdict
          <span className="bg-blueberry text-ink ml-auto rounded-full px-3 py-1 tracking-normal normal-case">
            {CONSENSUS[verdict.consensus]}
          </span>
        </div>
        <h2 className="font-display mt-3 text-xl leading-snug font-semibold text-balance sm:text-2xl">{verdict.headline}</h2>

        <div className="mt-4 flex items-center gap-3" role="meter" aria-valuenow={Math.round(verdict.confidence * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Confidence">
          <span className="text-sm font-semibold">Confidence</span>
          <div className="bg-blueberry/25 h-2.5 flex-1 overflow-hidden rounded-full">
            <motion.div
              className="bg-blueberry h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${verdict.confidence * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <span className="text-sm font-bold tabular-nums">{percent(verdict.confidence)}</span>
        </div>

        <div className="mt-5 text-[15px]">
          <CitedText text={verdict.answer} onCream />
        </div>

        <Section icon={ThumbsUp} title="Arguments that won">
          <ul className="space-y-2.5">
            {verdict.winning_arguments.map((item, index) => (
              <li key={index} className="bg-blueberry/10 rounded-2xl p-3.5">
                <AgentChip agentId={item.agent_id} />
                <p className="mt-1.5 text-sm font-medium">{item.argument}</p>
                <p className="text-on-accent/80 mt-1 text-sm">{item.why_it_won}</p>
              </li>
            ))}
          </ul>
        </Section>

        {verdict.rejected_arguments.length > 0 && (
          <Section icon={ShieldX} title="Arguments rejected">
            <ul className="space-y-2.5">
              {verdict.rejected_arguments.map((item, index) => (
                <li key={index} className="border-blueberry/30 rounded-2xl border p-3.5">
                  <AgentChip agentId={item.agent_id} />
                  <p className="mt-1.5 text-sm font-medium">{item.argument}</p>
                  <p className="text-on-accent/80 mt-1 text-sm">{item.why_rejected}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {verdict.remaining_uncertainty.length > 0 && (
          <Section icon={CircleHelp} title="Remaining uncertainty">
            <ul className="space-y-1.5 text-sm">
              {verdict.remaining_uncertainty.map((item, index) => (
                <li key={index} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section icon={Gavel} title={`How the debate unfolded (${verdict.rounds} rounds)`}>
          <p className="text-sm leading-relaxed">{verdict.debate_summary}</p>
        </Section>

        {verdict.key_evidence_ids.length > 0 && (
          <Section icon={Check} title="Key sources">
            <ul className="space-y-1 text-sm">
              {verdict.key_evidence_ids.map((id) => (
                <li key={id} className="flex items-center gap-2">
                  <CitationChip id={id} onCream />
                  <span className="truncate">{evidence[id]?.title}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section icon={Trophy} title="Final standings">
          <ol className="grid gap-2 sm:grid-cols-2">
            {verdict.standings.map((entry, index) => (
              <li key={entry.agent_id} className="bg-blueberry flex items-center gap-2.5 rounded-xl px-3 py-2">
                <span className="text-ink w-5 text-sm font-bold tabular-nums">{index + 1}</span>
                <AgentAvatarById id={entry.agent_id} />
                <span className="text-ink flex-1 truncate text-sm font-medium">{entry.name}</span>
                <span className="text-ink text-sm font-bold tabular-nums">{Math.round(entry.score)}</span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="mt-7 flex flex-wrap gap-2">
          <Button variant="inverse" icon={copied ? Check : Clipboard} onClick={copy}>
            {copied ? 'Copied' : 'Copy summary'}
          </Button>
          <Button variant="inverse" icon={Plus} onClick={() => navigate('/')}>
            New debate
          </Button>
        </div>
      </motion.article>
    </div>
  )
}

function AgentAvatarById({ id }) {
  const agent = useDebate((state) => state.agents[id])
  return agent ? <AgentAvatar agent={agent} size={24} /> : null
}
