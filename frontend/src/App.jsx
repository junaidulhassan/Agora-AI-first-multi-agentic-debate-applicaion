import Header from './components/layout/Header.jsx'
import Landing from './components/landing/Landing.jsx'
import DebateView from './components/debate/DebateView.jsx'
import HistoryDrawer from './components/history/HistoryDrawer.jsx'
import { useRoute } from './lib/router.js'

export default function App() {
  const route = useRoute()
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <a
        href="#main"
        className="bg-accent text-on-accent sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Header />
      <div id="main" className="min-h-0 flex-1">
        {route.name === 'debate' ? <DebateView key={route.debateId} debateId={route.debateId} /> : <Landing />}
      </div>
      <HistoryDrawer />
    </div>
  )
}
