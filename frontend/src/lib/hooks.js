import { useEffect, useRef, useState } from 'react'

export function useNow(intervalMs, enabled = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return undefined
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, enabled])
  return now
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

const revealed = new Set()

export function useReveal(id, text, enabled, charsPerFrame = 6) {
  const shouldAnimate = enabled && !revealed.has(id)
  const [count, setCount] = useState(shouldAnimate ? 0 : text.length)
  const skipRef = useRef(false)

  useEffect(() => {
    if (!shouldAnimate) {
      setCount(text.length)
      return undefined
    }
    let frame
    let current = 0
    const tick = () => {
      current = skipRef.current ? text.length : Math.min(text.length, current + charsPerFrame)
      setCount(current)
      if (current < text.length) {
        frame = requestAnimationFrame(tick)
      } else {
        revealed.add(id)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [id, text, shouldAnimate, charsPerFrame])

  return {
    visible: text.slice(0, count),
    done: count >= text.length,
    skip: () => {
      skipRef.current = true
    },
  }
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    onChange()
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}
