import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Gavel, Library, MessagesSquare, Network, Scale, Trophy } from 'lucide-react'
import ArenaGraph from '../graph/ArenaGraph.jsx'
import Button from '../ui/Button.jsx'
import Spinner from '../ui/Spinner.jsx'
import StatePanel from '../ui/StatePanel.jsx'
import AgentDetailPanel from './AgentDetailPanel.jsx'
import BenchPanel from './BenchPanel.jsx'
import DebateHeader from './DebateHeader.jsx'
import EvidencePanel from './EvidencePanel.jsx'
import LiveFeed from './LiveFeed.jsx'
import Scoreboard from './Scoreboard.jsx'
import VerdictView from './VerdictView.jsx'
import { useMediaQuery } from '../../lib/hooks.js'
import { navigate } from '../../lib/router.js'
import { useDebate } from '../../store/debateStore.js'

const TABS = [
  { id: 'feed', label: 'Live feed', icon: MessagesSquare },
  { id: 'evidence', label: 'Evidence', icon: Library },
  { id: 'bench', label: 'The bench', icon: Scale },
  { id: 'verdict', label: 'Verdict', icon: Gavel },
]

function Tabs({ value, onChange, extra, className = '' }) {
  return (
    <div role="tablist" aria-label="Debate panels" className={`flex gap-1 ${className}`}>
      {[...extra, ...TABS].map((tab) => {
        const selected = tab.id === value
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold whitespace-nowrap transition-all sm:text-sm ${
              selected ? 'bg-accent text-on-accent shadow-glow' : 'text-muted hover:text-ink hover:bg-ink/10'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            <span className={selected ? '' : 'max-sm:sr-only'}>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const MOBILE_EXTRA = [
  { id: 'arena', label: 'Arena', icon: Network },
  { id: 'scores', label: 'Scores', icon: Trophy },
]

export default function DebateView({ debateId }) {
  const load = useDebate((state) => state.load)
  const reset = useDebate((state) => state.reset)
  const loading = useDebate((state) => state.loading)
  const loadError = useDebate((state) => state.loadError)
  const meta = useDebate((state) => state.meta)
  const selectedId = useDebate((state) => state.selectedAgentId)
  const select = useDebate((state) => state.selectAgent)
  const hasVerdict = useDebate((state) => Boolean(state.verdict))
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [tab, setTab] = useState(() => (window.innerWidth < 1024 ? 'arena' : 'feed'))

  useEffect(() => {
    load(debateId)
    return () => reset()
  }, [debateId, load, reset])

  useEffect(() => {
    if (hasVerdict) setTab('verdict')
  }, [hasVerdict])

  if (loading || (!meta && !loadError)) return <Spinner label="Convening the chamber" className="py-32" />

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <StatePanel
          tone="error"
          title={loadError.status === 404 ? 'Debate not found' : 'Could not load this debate'}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => load(debateId)}>
                Try again
              </Button>
              <Button variant="primary" onClick={() => navigate('/')}>
                Back to Agora
              </Button>
            </div>
          }
        >
          {loadError.message}
        </StatePanel>
      </div>
    )
  }

  const arenaTab = tab === 'arena' || tab === 'scores'
  const showArena = desktop || tab === 'arena'
  const showScores = desktop || tab === 'scores'
  const showPanels = desktop || !arenaTab
  const activeTab = desktop && arenaTab ? 'feed' : tab
  const openVerdict = () => setTab('verdict')

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-4 sm:px-6 lg:h-[calc(100vh-4rem)]">
      <DebateHeader />

      {!desktop && <Tabs value={tab} onChange={setTab} extra={MOBILE_EXTRA} className="glass-deep rounded-2xl p-1" />}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {(showArena || showScores) && (
          <div className="flex min-h-0 flex-col gap-4">
            {showArena && (
              <div className="relative h-[460px] lg:h-auto lg:min-h-0 lg:flex-1">
                <ArenaGraph />
              </div>
            )}
            {showScores && (
              <div className="scroll-thin lg:max-h-[42%] lg:overflow-y-auto">
                <Scoreboard />
              </div>
            )}
          </div>
        )}

        {showPanels && (
          <div className="flex min-h-[560px] flex-col lg:min-h-0">
            {desktop && <Tabs value={activeTab} onChange={setTab} extra={[]} className="glass-deep mb-3 rounded-2xl p-1" />}
            <div className="glass-deep relative min-h-0 flex-1 overflow-hidden rounded-3xl">
              <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="h-full">
                {activeTab === 'feed' && <LiveFeed onOpenVerdict={openVerdict} />}
                {activeTab === 'evidence' && <EvidencePanel />}
                {activeTab === 'bench' && <BenchPanel />}
                {activeTab === 'verdict' && <VerdictView />}
              </div>
              <AnimatePresence>
                {selectedId && <AgentDetailPanel key={selectedId} agentId={selectedId} onClose={() => select(null)} />}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {!showPanels && selectedId && (
        <div className="fixed inset-0 z-40 p-3">
          <div className="relative h-full">
            <AgentDetailPanel agentId={selectedId} onClose={() => select(null)} />
          </div>
        </div>
      )}
    </main>
  )
}
