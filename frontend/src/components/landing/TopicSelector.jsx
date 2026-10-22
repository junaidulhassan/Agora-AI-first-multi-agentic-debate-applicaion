import { TOPICS } from '../../lib/topics.js'

export default function TopicSelector({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Topic" className="flex flex-wrap gap-2">
      {TOPICS.map((topic) => {
        const selected = topic.id === value
        const Icon = topic.icon
        return (
          <button
            key={topic.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(topic.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
              selected
                ? 'bg-accent text-on-accent border-transparent shadow-glow'
                : 'border-line text-ink hover:bg-ink/10'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {topic.label}
          </button>
        )
      })}
    </div>
  )
}
