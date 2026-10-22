import { memo, useEffect, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { Brain, Clock, Loader2, MessageSquareText, OctagonAlert, Search, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { agentColor, agentIcon, STATUS_LABELS } from '../../lib/agentMeta.js'
import { usePrefersReducedMotion } from '../../lib/hooks.js'
import { signed } from '../../lib/format.js'
import { useDebate } from '../../store/debateStore.js'

const STATUS_ICONS = {
  thinking: Brain,
  searching: Search,
  waiting: Clock,
  speaking: MessageSquareText,
}

const PENALTY_KINDS = new Set(['penalty', 'reprimand', 'warning'])

function AgentNode({ data }) {
  const agent = useDebate((state) => state.agents[data.agentId])
  const selected = useDebate((state) => state.selectedAgentId === data.agentId)
  const controls = useAnimationControls()
  const reduced = usePrefersReducedMotion()
  const flash = useTransientFlash(agent?.flash)

  const spoke = agent?.spokeNonce ?? 0
  useEffect(() => {
    if (spoke > 0 && !reduced) controls.start({ scale: [1, 1.16, 1], transition: { duration: 0.6 } })
  }, [spoke, controls, reduced])

  const flashNonce = agent?.flash?.nonce ?? 0
  useEffect(() => {
    if (flashNonce === 0 || reduced) return
    if (PENALTY_KINDS.has(agent.flash.kind)) {
      controls.start({ x: [0, -10, 10, -8, 8, -4, 4, 0], transition: { duration: 0.6 } })
    } else {
      controls.start({ scale: [1, 1.2, 1], transition: { duration: 0.7 } })
    }
  }, [flashNonce, controls, reduced])

  if (!agent) return null

  const isJudge = agent.role === 'judge'
  const size = isJudge ? 104 : 80
  const color = agentColor(agent)
  const Icon = agentIcon(agent)
  const active = ['thinking', 'searching', 'waiting', 'speaking'].includes(agent.status)
  const StatusIcon = STATUS_ICONS[agent.status]
  const penalized = flash && PENALTY_KINDS.has(flash.kind)
  const label = STATUS_LABELS[agent.status]

  return (
    <motion.div animate={controls} className="relative flex flex-col items-center" style={{ width: size + 40 }}>
      <Handle type="source" position={Position.Top} isConnectable={false} className="!pointer-events-none !opacity-0" style={centerStyle(size)} />
      <Handle type="target" position={Position.Top} isConnectable={false} className="!pointer-events-none !opacity-0" style={centerStyle(size)} />

      <div className="relative" style={{ width: size, height: size }}>
        {active && !reduced && (
          <span
            className="animate-pulse-ring absolute inset-0 rounded-full"
            style={{ border: `2px solid ${color}` }}
            aria-hidden
          />
        )}
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${agent.name}. ${label}.${agent.score != null ? ` Score ${Math.round(agent.score)}.` : ''} Open details`}
          className="bg-deep relative flex h-full w-full items-center justify-center rounded-full transition-shadow"
          style={{
            border: `${selected ? 4 : 2.5}px solid ${color}`,
            color,
            boxShadow: isJudge || selected || active ? `0 0 ${isJudge ? 40 : 24}px ${color}` : 'none',
          }}
        >
          <Icon style={{ width: size * 0.42, height: size * 0.42 }} aria-hidden />
        </button>

        {StatusIcon && (
          <span
            className="bg-deep text-ink absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border"
            title={agent.statusDetail ?? label}
          >
            {agent.status === 'waiting' ? (
              <Clock className="size-3.5" aria-hidden />
            ) : agent.status === 'thinking' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <StatusIcon className="size-3.5" aria-hidden />
            )}
          </span>
        )}

        <AnimatePresence>
          {flash && (
            <motion.span
              key={flash.nonce}
              initial={{ opacity: 0, y: 6, scale: 0.8 }}
              animate={{ opacity: 1, y: -4, scale: 1 }}
              exit={{ opacity: 0, y: -14 }}
              className={`bg-deep absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold whitespace-nowrap ${
                penalized ? 'border-danger text-danger' : 'border-success text-success'
              }`}
              role="status"
            >
              {penalized ? <OctagonAlert className="size-3.5" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
              {penalized ? 'Penalized' : 'Rewarded'} {flash.delta ? signed(flash.delta) : ''}
              {penalized ? <ThumbsDown className="size-3" aria-hidden /> : <ThumbsUp className="size-3" aria-hidden />}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 text-center leading-tight">
        <div className="text-ink max-w-[140px] truncate text-xs font-semibold" style={{ textShadow: '0 1px 6px var(--bg-deep)' }}>
          {agent.name}
        </div>
        {agent.score != null && (
          <div className="glass-deep mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums">
            {Math.round(agent.score)}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function centerStyle(size) {
  return { left: '50%', top: size / 2, transform: 'translate(-50%, -50%)' }
}

function useTransientFlash(source) {
  const nonce = source?.nonce ?? 0
  const [visible, setVisible] = useState(null)
  useEffect(() => {
    if (!nonce) return undefined
    setVisible(source)
    const timer = setTimeout(() => setVisible(null), 3200)
    return () => clearTimeout(timer)
  }, [nonce])
  return visible
}

export default memo(AgentNode)
