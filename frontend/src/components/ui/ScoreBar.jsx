import { motion } from 'framer-motion'

export default function ScoreBar({ value, color, height = 8, label }) {
  const clamped = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className="bg-deep/70 w-full overflow-hidden rounded-full"
      style={{ height }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  )
}
