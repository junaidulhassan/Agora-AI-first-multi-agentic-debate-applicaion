import { ExternalLink } from 'lucide-react'
import { useDebate } from '../../store/debateStore.js'

const TOKEN = /(\[E\d+\])/g

export function CitationChip({ id, onCream = false }) {
  const evidence = useDebate((state) => state.evidence[id])
  if (!evidence) return <span className="text-muted text-xs">[{id}]</span>
  return (
    <span className="group relative inline-block align-baseline">
      <a
        href={evidence.url}
        target="_blank"
        rel="noreferrer noopener"
        className={`mx-0.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-px text-[11px] font-semibold no-underline transition-colors ${
          onCream ? 'bg-blueberry/15 text-on-accent hover:bg-blueberry hover:text-ink' : 'bg-ink/10 text-ink hover:bg-accent hover:text-on-accent'
        }`}
        aria-label={`Source ${id}: ${evidence.title}, ${evidence.domain}`}
      >
        {id}
      </a>
      <span
        role="tooltip"
        className="glass-strong shadow-panel pointer-events-none invisible absolute bottom-full left-1/2 z-40 mb-2 w-72 -translate-x-1/2 rounded-xl p-3 text-left text-xs opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <span className="text-ink block font-semibold">{evidence.title}</span>
        <span className="text-muted mt-0.5 flex items-center gap-1">
          <ExternalLink className="size-3" aria-hidden />
          {evidence.domain}
        </span>
        <span className="text-muted mt-1.5 line-clamp-4 block">{evidence.snippet}</span>
      </span>
    </span>
  )
}

export default function CitedText({ text, className = '', onCream = false }) {
  const cleaned = text.replace(/\[E?\d*$/, '')
  const paragraphs = cleaned.split(/\n{2,}/)
  return (
    <div className={`space-y-2 ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="leading-relaxed">
          {paragraph.split(TOKEN).map((part, partIndex) =>
            /^\[E\d+\]$/.test(part) ? <CitationChip key={partIndex} id={part.slice(1, -1)} onCream={onCream} /> : part,
          )}
        </p>
      ))}
    </div>
  )
}
