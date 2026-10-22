import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, KeyRound, Search } from 'lucide-react'
import AgoraLogo from '../brand/AgoraLogo.jsx'
import AgentAvatar from '../ui/AgentAvatar.jsx'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import StatePanel from '../ui/StatePanel.jsx'
import TopicSelector from './TopicSelector.jsx'
import RecentDebates from './RecentDebates.jsx'
import { api } from '../../lib/api.js'
import { navigate } from '../../lib/router.js'
import { TOPIC_BY_ID } from '../../lib/topics.js'
import { useApp } from '../../store/appStore.js'

const MIN_LENGTH = 8

export default function Landing() {
  const config = useApp((state) => state.config)
  const configError = useApp((state) => state.configError)
  const loadConfig = useApp((state) => state.loadConfig)
  const loadHistory = useApp((state) => state.loadHistory)

  const [topic, setTopic] = useState('philosophy')
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadConfig()
    loadHistory()
  }, [loadConfig, loadHistory])

  const maxLength = config?.max_question_length ?? 600
  const trimmed = question.trim()
  const valid = trimmed.length >= MIN_LENGTH && trimmed.length <= maxLength
  const blocked = config && !config.ready
  const examples = useMemo(() => TOPIC_BY_ID[topic]?.examples ?? [], [topic])
  const panel = config?.agents ?? []

  const submit = async (event) => {
    event.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { debate } = await api.createDebate(trimmed, topic)
      navigate(`/debate/${debate.id}`)
    } catch (caught) {
      setError(caught)
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 pt-10 pb-20 sm:px-6 sm:pt-16">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center gap-5 text-center"
      >
        <div className="animate-float">
          <AgoraLogo size={92} wordmark={false} animated />
        </div>
        <h1 className="font-display text-ink text-5xl font-semibold tracking-wide sm:text-6xl">Agora</h1>
        <p className="font-display text-muted text-balance text-xl italic sm:text-2xl">Where AI argues before it answers</p>
        <p className="text-muted max-w-xl text-sm text-balance sm:text-base">
          Pose any question. A panel of specialist agents will debate it in the open, fact-check each other with live web
          evidence, and answer to a Judge who rules on every claim before a verdict is given.
        </p>
      </motion.section>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        className="glass-strong shadow-panel w-full rounded-3xl p-5 sm:p-8"
        aria-label="Start a debate"
      >
        <fieldset className="mb-5">
          <legend className="text-muted mb-3 text-sm font-medium">Choose a topic</legend>
          <TopicSelector value={topic} onChange={setTopic} />
        </fieldset>

        <label htmlFor="question" className="text-muted mb-2 block text-sm font-medium">
          Your question
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          maxLength={maxLength}
          placeholder="Does God exist?"
          aria-describedby="question-hint"
          className="bg-deep/60 text-ink placeholder:text-muted focus:border-accent w-full resize-none rounded-2xl border px-4 py-3 text-lg outline-none transition-colors"
        />
        <div id="question-hint" className="text-muted mt-2 flex items-center justify-between gap-3 text-xs">
          <span>The panel will not answer immediately. It will argue first.</span>
          <span aria-live="polite">
            {trimmed.length}/{maxLength}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Example questions">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuestion(example)}
              className="border-line text-muted hover:text-ink hover:bg-ink/10 rounded-full border px-3 py-1.5 text-left text-xs transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        {blocked && (
          <div role="alert" className="border-warning/50 bg-warning/10 mt-5 flex gap-3 rounded-2xl border p-4 text-sm">
            <KeyRound className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="text-warning font-semibold">API keys are missing on the server</p>
              <p className="text-muted mt-1">Add these variables to your .env file and restart the backend:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {config.missing_keys.map((key) => (
                  <Badge key={key} tone="warning">
                    {key}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {config && config.ready && !config.web_search && (
          <div className="border-warning/50 bg-warning/10 mt-5 flex gap-3 rounded-2xl border p-4 text-sm">
            <Search className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-muted">
              <span className="text-warning font-semibold">Web search is offline.</span> TAVILY_API_KEY is not set, so every
              argument will be flagged as unverified.
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="border-danger/50 bg-danger/10 mt-5 flex gap-3 rounded-2xl border p-4 text-sm">
            <AlertTriangle className="text-danger mt-0.5 size-5 shrink-0" aria-hidden />
            <p>{error.message}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={!valid || blocked} icon={ArrowRight}>
            Convene the Agora
          </Button>
        </div>
      </motion.form>

      {configError && (
        <StatePanel
          tone="error"
          title="The Agora server is unreachable"
          action={
            <Button variant="secondary" onClick={loadConfig}>
              Try again
            </Button>
          }
        >
          {configError.message}
        </StatePanel>
      )}

      {panel.length > 0 && (
        <section className="w-full" aria-label="The panel">
          <h2 className="text-muted mb-3 text-center text-sm font-medium tracking-widest uppercase">The panel</h2>
          <ul className="flex flex-wrap justify-center gap-3">
            {panel.map((agent) => (
              <li key={agent.id} className="glass flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5">
                <AgentAvatar agent={agent} size={30} />
                <span className="text-sm font-medium">{agent.name}</span>
              </li>
            ))}
          </ul>
          {config?.specialist && (
            <p className="text-muted mt-3 text-center text-xs">
              A domain specialist is added to the panel for each question.
            </p>
          )}
        </section>
      )}

      <RecentDebates />
    </main>
  )
}
