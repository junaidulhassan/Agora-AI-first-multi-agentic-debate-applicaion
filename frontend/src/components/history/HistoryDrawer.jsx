import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, X } from 'lucide-react'
import Badge from '../ui/Badge.jsx'
import Spinner from '../ui/Spinner.jsx'
import StatePanel from '../ui/StatePanel.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import { timeAgo } from '../../lib/format.js'
import { navigate, useRoute } from '../../lib/router.js'
import { TOPIC_BY_ID } from '../../lib/topics.js'
import { useApp } from '../../store/appStore.js'

export default function HistoryDrawer() {
  const open = useApp((state) => state.historyOpen)
  const close = useApp((state) => state.closeHistory)
  const history = useApp((state) => state.history)
  const loading = useApp((state) => state.historyLoading)
  const remove = useApp((state) => state.removeDebate)
  const route = useRoute()
  const [confirming, setConfirming] = useState(null)
  const [failure, setFailure] = useState(null)

  const handleDelete = async (id) => {
    if (confirming !== id) {
      setConfirming(id)
      return
    }
    try {
      await remove(id)
      if (route.name === 'debate' && route.debateId === id) navigate('/')
    } catch (error) {
      setFailure(error.message)
    }
    setConfirming(null)
  }

  const handleOpen = (id) => {
    navigate(`/debate/${id}`)
    close()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Close history" className="bg-overlay absolute inset-0" onClick={close} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Debate history"
            className="glass-strong shadow-panel relative flex h-full w-full max-w-md flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="font-display text-xl font-semibold">Debate history</h2>
              <button type="button" onClick={close} aria-label="Close" className="hover:bg-ink/10 rounded-lg p-2">
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-5">
              {failure && (
                <p role="alert" className="border-danger/50 bg-danger/10 rounded-xl border p-3 text-sm">
                  {failure}
                </p>
              )}
              {loading && history.length === 0 && <Spinner label="Loading debates" className="py-10" />}
              {!loading && history.length === 0 && (
                <StatePanel title="No debates yet">Convene the Agora to start your first debate.</StatePanel>
              )}
              {history.map((item) => {
                const topic = TOPIC_BY_ID[item.topic]
                return (
                  <article key={item.id} className="glass-deep rounded-2xl p-4">
                    <button type="button" onClick={() => handleOpen(item.id)} className="w-full text-left">
                      <p className="line-clamp-2 text-sm font-semibold">{item.question}</p>
                      {item.verdict_headline && (
                        <p className="text-muted mt-1.5 line-clamp-2 text-xs italic">{item.verdict_headline}</p>
                      )}
                    </button>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <Badge tone="muted">{topic?.label ?? item.topic}</Badge>
                      <span className="text-muted text-xs">{timeAgo(item.created_at)}</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        aria-label={confirming === item.id ? 'Confirm delete' : 'Delete debate'}
                        className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors ${
                          confirming === item.id ? 'bg-danger/20 text-danger' : 'text-muted hover:bg-ink/10'
                        }`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        {confirming === item.id ? 'Confirm' : 'Delete'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
