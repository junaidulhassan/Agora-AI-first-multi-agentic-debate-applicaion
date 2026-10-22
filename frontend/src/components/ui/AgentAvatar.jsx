import { agentColor, agentIcon } from '../../lib/agentMeta.js'

export default function AgentAvatar({ agent, size = 36, className = '' }) {
  const Icon = agentIcon(agent)
  const color = agentColor(agent)
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-deep ${className}`}
      style={{ width: size, height: size, border: `2px solid ${color}`, color }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  )
}
