import { History, Plus } from 'lucide-react'
import AgoraLogo from '../brand/AgoraLogo.jsx'
import Button from '../ui/Button.jsx'
import { navigate } from '../../lib/router.js'
import { useApp } from '../../store/appStore.js'

export default function Header() {
  const openHistory = useApp((state) => state.openHistory)
  return (
    <header className="glass-deep sticky top-0 z-30 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#/" className="rounded-lg" aria-label="Agora home">
          <AgoraLogo size={36} tagline />
        </a>
        <nav className="flex items-center gap-2" aria-label="Primary">
          <Button variant="ghost" icon={History} onClick={openHistory} aria-label="Open debate history">
            <span className="max-sm:hidden">History</span>
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => navigate('/')}>
            <span className="max-sm:hidden">New debate</span>
            <span className="sm:hidden">New</span>
          </Button>
        </nav>
      </div>
    </header>
  )
}
