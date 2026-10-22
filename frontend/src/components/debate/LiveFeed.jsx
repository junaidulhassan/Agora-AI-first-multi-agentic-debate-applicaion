import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Clock, Loader2, Search, Brain, WifiOff } from 'lucide-react'
import MessageCard from './MessageCard.jsx'
import AgentAvatar from '../ui/AgentAvatar.jsx'
import StatePanel from '../ui/StatePanel.jsx'
import { agentColor, STATUS_LABELS } from '../../lib/agentMeta.js'
import { isActive, useDebate } from '../../store/debateStore.js'

const WORKING = new Set(['thinking', 'searching', 'waiting'])
const STATUS_ICON = { thinking: Brain, searching: Search, waiting: Clock }
const LIVE_WINDOW_MS = 15000

function ThinkingRow({ agent }) {
  const Icon = STATUS_ICON[agent.status] ?? Loader2
  const color = agentColor(agent)
  return (
    <li className="glass-deep flex items-center gap-3 rounded-2xl px-3 py-2.5" aria-live="polite">
      <AgentAvatar agent={agent} size={28} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium" style={{ color }}>
          {agent.name}
        </div>
        <div className="text-muted flex items-center gap-1.5 truncate text-xs">
          <Icon className={`size-3 shrink-0 ${agent.status === 'thinking' ? 'animate-spin' : ''}`} aria-hidden />
          <span className="truncate">{agent.statusDetail || STATUS_LABELS[agent.status]}</span>
        </div>
      </div>
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1.5 animate-bounce rounded-full"
            style={{ background: color, animationDelay: `${dot * 140}ms` }}
          />
        ))}
      </span>
    </li>
  )
}

export default function LiveFeed({ onOpenVerdict }) {
  const messages = useDebate((state) => state.messages)
  const agents = useDebate((state) => state.agents)
  const active = useDebate((state) => isActive(state.meta))
  const connection = useDebate((state) => state.connection)
  const containerRef = useRef(null)
  const contentRef = useRef(null)
  const pinnedRef = useRef(true)
  const interactingRef = useRef(false)
  const interactionTimer = useRef(null)
  const [pinned, setPinned] = useState(true)

  const working = useMemo(
    () => Object.values(agents).filter((agent) => WORKING.has(agent.status)),
    [agents],
  )

  const scrollToEnd = () => {
    const element = containerRef.current
    if (element) element.scrollTop = element.scrollHeight
  }

  useEffect(() => {
    const content = contentRef.current
    if (!content) return undefined
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToEnd()
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  const markInteraction = () => {
    interactingRef.current = true
    clearTimeout(interactionTimer.current)
    interactionTimer.current = setTimeout(() => {
      interactingRef.current = false
    }, 250)
  }

  const onScroll = () => {
    const element = containerRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    if (distance < 40) {
      pinnedRef.current = true
      setPinned(true)
    } else if (interactingRef.current) {
      pinnedRef.current = false
      setPinned(false)
    }
  }

  const jump = () => {
    pinnedRef.current = true
    setPinned(true)
    scrollToEnd()
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={containerRef}
        onScroll={onScroll}
        onWheel={markInteraction}
        onTouchMove={markInteraction}
        onPointerDown={markInteraction}
        onKeyDown={markInteraction}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"
        role="log"
        aria-label="Live debate feed"
        aria-live="off"
        tabIndex={0}
      >
        <div ref={contentRef} className="space-y-3">
        {messages.length === 0 && !working.length && (
          <StatePanel title="The chamber is quiet">The Judge is preparing to open the debate.</StatePanel>
        )}
        {messages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            animate={active && Date.now() - new Date(message.created_at).getTime() < LIVE_WINDOW_MS}
            onOpenVerdict={onOpenVerdict}
          />
        ))}
        {working.length > 0 && (
          <ul className="space-y-2" aria-label="Agents at work">
            {working.map((agent) => (
              <ThinkingRow key={agent.id} agent={agent} />
            ))}
          </ul>
        )}
        {active && connection === 'reconnecting' && (
          <p className="text-warning flex items-center gap-2 px-2 text-xs">
            <WifiOff className="size-3.5" aria-hidden /> Connection lost. Reconnecting to catch up on anything missed.
          </p>
        )}
        </div>
      </div>
      {!pinned && (
        <button
          type="button"
          onClick={jump}
          className="bg-accent text-on-accent shadow-glow absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold"
        >
          <ArrowDown className="size-3.5" aria-hidden /> Latest
        </button>
      )}
    </div>
  )
}
