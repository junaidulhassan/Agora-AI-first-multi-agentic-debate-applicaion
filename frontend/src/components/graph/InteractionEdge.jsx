import { EdgeLabelRenderer } from '@xyflow/react'
import { Check, Megaphone, Gavel, HelpCircle, Flag, OctagonAlert, ShieldAlert, ThumbsUp, TriangleAlert, Swords, Undo2 } from 'lucide-react'
import { usePrefersReducedMotion } from '../../lib/hooks.js'
import { INTERACTION_LABELS } from '../../lib/format.js'

const KIND_ICONS = {
  rebuttal: Swords,
  agreement: Check,
  accusation: ShieldAlert,
  concession: Undo2,
  question: HelpCircle,
  challenge: Megaphone,
  ruling: Gavel,
  warning: TriangleAlert,
  reprimand: Flag,
  penalty: OctagonAlert,
  reward: ThumbsUp,
  instruction: Gavel,
}

const KIND_STYLE = {
  rebuttal: { width: 2.4, dash: null },
  agreement: { width: 1.8, dash: null },
  accusation: { width: 3, dash: '1 6' },
  concession: { width: 1.6, dash: '10 4 2 4' },
  question: { width: 1.6, dash: '3 5' },
  challenge: { width: 3.2, dash: '12 3' },
  ruling: { width: 1.6, dash: null },
  warning: { width: 2, dash: null },
  reprimand: { width: 2.6, dash: null },
  penalty: { width: 3.2, dash: null },
  reward: { width: 2.2, dash: null },
  instruction: { width: 1.4, dash: '8 5' },
}

const KIND_SLOT = Object.keys(KIND_STYLE)

function quadraticPoint(sx, sy, cx, cy, tx, ty, t) {
  const u = 1 - t
  return {
    x: u * u * sx + 2 * u * t * cx + t * t * tx,
    y: u * u * sy + 2 * u * t * cy + t * t * ty,
    angle:
      (Math.atan2(2 * u * (cy - sy) + 2 * t * (ty - cy), 2 * u * (cx - sx) + 2 * t * (tx - cx)) * 180) / Math.PI,
  }
}

export default function InteractionEdge({ id, source, target, sourceX, sourceY, targetX, targetY, data }) {
  const reduced = usePrefersReducedMotion()
  const { kind, color, unverified, recent, dimmed, count, summary, fromJudge } = data
  const style = KIND_STYLE[kind] ?? KIND_STYLE.rebuttal
  const Icon = KIND_ICONS[kind] ?? Swords

  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const length = Math.hypot(dx, dy) || 1
  const direction = source < target ? 1 : -1
  const offset = direction * (16 + KIND_SLOT.indexOf(kind) * 9)
  const cx = (sourceX + targetX) / 2 + (-dy / length) * offset
  const cy = (sourceY + targetY) / 2 + (dx / length) * offset
  const path = `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`
  const arrow = quadraticPoint(sourceX, sourceY, cx, cy, targetX, targetY, 0.66)
  const mid = quadraticPoint(sourceX, sourceY, cx, cy, targetX, targetY, 0.5)

  const dash = unverified ? '7 6' : style.dash
  const opacity = dimmed ? 0.1 : recent ? 1 : 0.5
  const width = recent ? style.width + 0.8 : style.width

  return (
    <g style={{ opacity, transition: 'opacity 0.4s' }}>
      <title>{`${INTERACTION_LABELS[kind] ?? kind}${count > 1 ? ` x${count}` : ''}${unverified ? ' (unverified)' : ''}: ${summary}`}</title>
      <path
        id={id}
        d={path}
        fill="none"
        strokeLinecap="round"
        strokeWidth={width}
        strokeDasharray={dash ?? undefined}
        className={recent && !reduced ? 'edge-flowing' : undefined}
        style={{ stroke: color, filter: recent ? `drop-shadow(0 0 5px ${color})` : undefined }}
      />
      <path
        d="M -6 -4.5 L 5 0 L -6 4.5 z"
        transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
        style={{ fill: color }}
      />
      {recent && !reduced && (
        <circle r="3.4" style={{ fill: color }}>
          <animateMotion dur="1.5s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      {!fromJudge && (recent || count > 1) && !dimmed && (
        <EdgeLabelRenderer>
          <div
            className="glass-deep pointer-events-none absolute flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`, color }}
          >
            <Icon className="size-3" aria-hidden />
            <span className="text-ink">{count > 1 ? count : INTERACTION_LABELS[kind]}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  )
}
