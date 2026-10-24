export function timeAgo(iso) {
  if (!iso) return ''
  const seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function clockTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function signed(value, digits = 0) {
  const rounded = Number(value).toFixed(digits)
  return value > 0 ? `+${rounded}` : rounded
}

export function percent(value) {
  return `${Math.round((value ?? 0) * 100)}%`
}

export const PHASE_ORDER = ['intake', 'opening', 'rebuttal', 'conflicts', 'ruling', 'convergence', 'verdict']

export const PHASE_LABELS = {
  intake: 'Analysis',
  opening: 'Openings',
  conflicts: 'Conflicts',
  rebuttal: 'Cross-exam',
  ruling: 'Ruling',
  convergence: 'Convergence',
  verdict: 'Verdict',
  completed: 'Complete',
}

export const MESSAGE_KIND_LABELS = {
  analysis: 'Opening address',
  opening: 'Opening statement',
  rebuttal: 'Rebuttal',
  instruction: 'Instruction',
  conflict_report: 'Conflict report',
  ruling: 'Ruling',
  warning: 'Warning',
  reprimand: 'Reprimand',
  penalty: 'Penalty',
  reward: 'Reward',
  judge_reply: 'Reply to challenge',
  departure: 'Left the debate',
  convergence: 'Convergence check',
  verdict: 'Final verdict',
}

export const INTERACTION_LABELS = {
  rebuttal: 'Rebuttal',
  agreement: 'Agreement',
  accusation: 'Fallacy accusation',
  concession: 'Concession',
  question: 'Question',
  challenge: 'Challenge to Judge',
  ruling: 'Judge ruling',
  warning: 'Judge warning',
  reprimand: 'Reprimand',
  penalty: 'Penalty',
  reward: 'Reward',
  instruction: 'Instruction',
}

export const JUDGE_KINDS = new Set(['ruling', 'warning', 'reprimand', 'penalty', 'reward', 'instruction'])
