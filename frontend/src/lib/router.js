import { useEffect, useState } from 'react'

function parse(hash) {
  const path = hash.replace(/^#/, '') || '/'
  const debate = path.match(/^\/debate\/([^/]+)/)
  if (debate) return { name: 'debate', debateId: debate[1] }
  return { name: 'landing' }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(path) {
  window.location.hash = path
}
