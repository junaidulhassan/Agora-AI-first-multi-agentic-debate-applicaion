import { motion } from 'framer-motion'

const NODES = [
  { token: '--agent-empiricist', angle: -90 },
  { token: '--agent-logician', angle: -30 },
  { token: '--agent-philosopher', angle: 30 },
  { token: '--agent-historian', angle: 90 },
  { token: '--agent-skeptic', angle: 150 },
  { token: '--agent-pragmatist', angle: 210 },
]

const CENTER = 32
const RING = 20

function polar(angle) {
  const radians = (angle * Math.PI) / 180
  return { x: CENTER + RING * Math.cos(radians), y: CENTER + RING * Math.sin(radians) }
}

export function AgoraMark({ size = 40, animated = false, className = '', framed = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Agora logo"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {framed && <rect width="64" height="64" rx="16" style={{ fill: 'var(--bg-base)' }} />}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RING}
        fill="none"
        strokeWidth="1.5"
        style={{ stroke: 'var(--text)', strokeOpacity: 0.28 }}
      />
      <motion.g
        style={{ originX: '32px', originY: '32px' }}
        animate={animated ? { rotate: 360 } : undefined}
        transition={animated ? { duration: 48, repeat: Infinity, ease: 'linear' } : undefined}
      >
        {NODES.map((node) => {
          const point = polar(node.angle)
          return (
            <g key={node.token}>
              <line
                x1={CENTER}
                y1={CENTER}
                x2={point.x}
                y2={point.y}
                strokeWidth="1.2"
                style={{ stroke: 'var(--text)', strokeOpacity: 0.3 }}
              />
              <circle cx={point.x} cy={point.y} r="4" style={{ fill: `var(${node.token})` }} />
            </g>
          )
        })}
      </motion.g>
      <circle cx={CENTER} cy={CENTER} r="8" style={{ fill: 'var(--cream-soda)' }} />
      <circle cx={CENTER} cy={CENTER} r="8" fill="none" strokeWidth="1" style={{ stroke: 'var(--accent-glow)' }} />
    </svg>
  )
}

export default function AgoraLogo({ size = 40, wordmark = true, animated = false, tagline = false, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <AgoraMark size={size} animated={animated} />
      {wordmark && (
        <div className="leading-none">
          <div className="font-display text-ink font-semibold tracking-wide" style={{ fontSize: size * 0.58 }}>
            Agora
          </div>
          {tagline && <div className="text-muted mt-1 hidden text-xs sm:block">Where AI argues before it answers</div>}
        </div>
      )}
    </div>
  )
}
