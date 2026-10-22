import { websocketUrl } from './api.js'

const MAX_DELAY_MS = 15000
const SILENCE_LIMIT_MS = 70000

export function openDebateSocket({ debateId, getLastSeq, onEvent, onStatus }) {
  let socket = null
  let attempt = 0
  let finished = false
  let reconnectTimer = null
  let lastActivity = Date.now()

  const watchdog = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN && Date.now() - lastActivity > SILENCE_LIMIT_MS) {
      socket.close()
    }
  }, 10000)

  const scheduleReconnect = () => {
    if (finished) return
    const delay = Math.min(MAX_DELAY_MS, 800 * 2 ** attempt) + Math.random() * 400
    attempt += 1
    onStatus('reconnecting', attempt)
    reconnectTimer = setTimeout(connect, delay)
  }

  const connect = () => {
    if (finished) return
    onStatus(attempt === 0 ? 'connecting' : 'reconnecting', attempt)
    socket = new WebSocket(websocketUrl(debateId, getLastSeq()))
    socket.onopen = () => {
      attempt = 0
      lastActivity = Date.now()
      onStatus('open', 0)
    }
    socket.onmessage = (message) => {
      lastActivity = Date.now()
      let event
      try {
        event = JSON.parse(message.data)
      } catch {
        return
      }
      if (event.type === 'stream_closed') {
        finished = true
        onStatus('closed', 0)
        socket.close()
        return
      }
      onEvent(event)
    }
    socket.onclose = (closeEvent) => {
      if (finished) return
      if (closeEvent.code === 4404) {
        finished = true
        onStatus('missing', 0)
        return
      }
      scheduleReconnect()
    }
    socket.onerror = () => {
      socket.close()
    }
  }

  connect()

  return {
    send(payload) {
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload))
    },
    close() {
      finished = true
      clearInterval(watchdog)
      clearTimeout(reconnectTimer)
      if (socket) {
        socket.onclose = null
        socket.close()
      }
    },
  }
}
