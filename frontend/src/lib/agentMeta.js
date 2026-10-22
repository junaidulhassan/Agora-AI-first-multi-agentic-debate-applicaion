import {
  Atom,
  Gavel,
  FlaskConical,
  Handshake,
  Landmark,
  Microscope,
  Scale,
  ScrollText,
  ShieldQuestion,
  Sigma,
} from 'lucide-react'

const ICONS = {
  scale: Gavel,
  flask: FlaskConical,
  sigma: Sigma,
  landmark: Landmark,
  scroll: ScrollText,
  'shield-question': ShieldQuestion,
  'scale-balanced': Handshake,
  microscope: Microscope,
}

export function agentIcon(agent) {
  return ICONS[agent?.icon] ?? Atom
}

export function agentColor(agent) {
  return agent?.color_token ? `var(--${agent.color_token})` : 'var(--text)'
}

export const JudgeIcon = Scale

export const STATUS_LABELS = {
  idle: 'Idle',
  thinking: 'Thinking',
  searching: 'Searching the web',
  waiting: 'Waiting for response',
  speaking: 'Speaking',
  penalized: 'Penalized',
}
