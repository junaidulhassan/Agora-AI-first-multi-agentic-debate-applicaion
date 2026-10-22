import { AlertTriangle, Inbox } from 'lucide-react'

export default function StatePanel({ tone = 'empty', title, children, action }) {
  const Icon = tone === 'error' ? AlertTriangle : Inbox
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`glass-deep flex flex-col items-center gap-3 rounded-2xl p-8 text-center ${
        tone === 'error' ? 'border-danger/50' : ''
      }`}
    >
      <Icon className={`size-8 ${tone === 'error' ? 'text-danger' : 'text-muted'}`} aria-hidden />
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <div className="text-muted max-w-md text-sm">{children}</div>}
      {action}
    </div>
  )
}
