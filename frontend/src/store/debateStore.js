import { create } from 'zustand'
import { api } from '../lib/api.js'
import { openDebateSocket } from '../lib/socket.js'

const ACTIVE_STATUSES = new Set(['pending', 'running'])
const TERMINAL_EVENTS = new Set(['debate_completed', 'debate_failed', 'debate_cancelled'])

const blankDebate = () => ({
  debateId: null,
  meta: null,
  agents: {},
  agentOrder: [],
  messages: [],
  evidence: {},
  interactions: [],
  conflicts: [],
  rulings: [],
  actions: [],
  scoreHistory: {},
  phase: null,
  phaseLabel: null,
  round: 0,
  convergence: null,
  verdict: null,
  limits: null,
  webSearch: true,
  searchFailures: [],
  failure: null,
  lastSeq: 0,
})

const makeAgent = (profile, previous) => ({
  score: null,
  delta: 0,
  reason: '',
  status: 'idle',
  statusDetail: null,
  elapsed: 0,
  spokeNonce: 0,
  flash: null,
  ...previous,
  ...profile,
})

function patchAgent(state, agentId, patch) {
  const agent = state.agents[agentId]
  if (!agent) return state
  return { ...state, agents: { ...state.agents, [agentId]: { ...agent, ...patch } } }
}

function reduceEvent(state, event, live) {
  const payload = event.payload ?? {}
  let next = event.seq > state.lastSeq ? { ...state, lastSeq: event.seq } : state

  switch (event.type) {
    case 'debate_started': {
      const agents = {}
      const order = []
      payload.agents.forEach((profile) => {
        agents[profile.id] = makeAgent(profile)
        order.push(profile.id)
      })
      return {
        ...next,
        meta: payload.debate,
        agents,
        agentOrder: order,
        limits: payload.limits,
        webSearch: payload.web_search,
      }
    }
    case 'panel_updated': {
      const agents = { ...next.agents }
      const order = [...next.agentOrder]
      payload.agents.forEach((profile) => {
        agents[profile.id] = makeAgent(profile, agents[profile.id])
        if (!order.includes(profile.id)) order.push(profile.id)
      })
      return { ...next, agents, agentOrder: order }
    }
    case 'agent_status':
      return patchAgent(next, payload.agent_id, {
        status: payload.status,
        statusDetail: payload.detail ?? null,
        elapsed: payload.elapsed_s ?? 0,
      })
    case 'phase_changed':
      return {
        ...next,
        phase: payload.phase,
        phaseLabel: payload.label,
        round: payload.round,
        meta: next.meta ? { ...next.meta, phase: payload.phase, round: payload.round } : next.meta,
      }
    case 'scores_updated': {
      const agents = { ...next.agents }
      const history = { ...next.scoreHistory }
      Object.entries(payload.scores).forEach(([agentId, entry]) => {
        if (!agents[agentId]) return
        agents[agentId] = { ...agents[agentId], score: entry.score, delta: entry.delta, reason: entry.reason }
        history[agentId] = [...(history[agentId] ?? []), { round: payload.round, score: entry.score, seq: event.seq }]
      })
      return { ...next, agents, scoreHistory: history }
    }
    case 'message': {
      const message = payload.message
      const replaced = next.messages.some((item) => item.id === message.id)
      const messages = replaced ? next.messages : [...next.messages, message]
      const agent = next.agents[message.author_id]
      const updated = { ...next, messages }
      return live && agent ? patchAgent(updated, agent.id, { spokeNonce: agent.spokeNonce + 1 }) : updated
    }
    case 'interaction':
      return {
        ...next,
        interactions: [...next.interactions, { ...payload.interaction, at: live ? Date.now() : 0 }],
      }
    case 'evidence_added':
      return { ...next, evidence: { ...next.evidence, [payload.evidence.id]: payload.evidence } }
    case 'search_failed':
      return { ...next, searchFailures: [...next.searchFailures, payload] }
    case 'conflicts_updated':
      return { ...next, conflicts: payload.conflicts }
    case 'ruling':
      return { ...next, rulings: [...next.rulings, payload.ruling] }
    case 'judge_action': {
      const action = payload.action
      const agent = next.agents[action.target_id]
      const updated = { ...next, actions: [...next.actions, action] }
      if (!live || !agent) return updated
      return patchAgent(updated, agent.id, {
        flash: { kind: action.kind, delta: action.score_delta, nonce: (agent.flash?.nonce ?? 0) + 1 },
      })
    }
    case 'convergence':
      return { ...next, convergence: payload }
    case 'verdict':
      return { ...next, verdict: payload.verdict }
    case 'debate_completed':
    case 'debate_cancelled':
      return { ...next, meta: { ...next.meta, ...payload.debate }, agents: resetStatuses(next.agents) }
    case 'debate_failed':
      return {
        ...next,
        meta: { ...next.meta, ...payload.debate },
        failure: payload.error,
        agents: resetStatuses(next.agents),
      }
    default:
      return next
  }
}

function resetStatuses(agents) {
  return Object.fromEntries(
    Object.entries(agents).map(([id, agent]) => [id, { ...agent, status: 'idle', statusDetail: null }]),
  )
}

let activeSocket = null
let loadToken = 0

export const useDebate = create((set, get) => ({
  ...blankDebate(),
  loading: false,
  loadError: null,
  connection: 'idle',
  reconnectAttempt: 0,
  selectedAgentId: null,

  reset() {
    activeSocket?.close()
    activeSocket = null
    loadToken += 1
    set({ ...blankDebate(), loading: false, loadError: null, connection: 'idle', reconnectAttempt: 0, selectedAgentId: null })
  },

  selectAgent(agentId) {
    set({ selectedAgentId: agentId })
  },

  async load(debateId) {
    get().reset()
    const token = loadToken
    set({ loading: true, debateId })
    try {
      const { debate, events } = await api.getDebate(debateId)
      if (token !== loadToken) return
      let state = { ...blankDebate(), debateId, meta: debate }
      for (const event of events) state = reduceEvent(state, event, false)
      if (!state.meta) state.meta = debate
      const settled = !ACTIVE_STATUSES.has(debate.status)
      set({
        ...state,
        meta: { ...state.meta, ...debate },
        agents: settled ? resetStatuses(state.agents) : state.agents,
        loading: false,
      })
      if (ACTIVE_STATUSES.has(debate.status)) get().connect(debateId)
    } catch (error) {
      if (token !== loadToken) return
      set({ loading: false, loadError: error })
    }
  },

  connect(debateId) {
    activeSocket?.close()
    activeSocket = openDebateSocket({
      debateId,
      getLastSeq: () => get().lastSeq,
      onStatus: (connection, attempt) => {
        set({ connection, reconnectAttempt: attempt })
        if (connection === 'closed' || connection === 'missing') get().refresh()
      },
      onEvent: (event) => {
        if (event.seq > 0 && event.seq <= get().lastSeq) return
        if (event.type === 'heartbeat' || event.type === 'pong') return
        set((state) => reduceEvent(state, event, true))
        if (TERMINAL_EVENTS.has(event.type)) set({ connection: 'closed' })
      },
    })
  },

  async refresh() {
    const { debateId } = get()
    if (!debateId) return
    try {
      const { debate, events } = await api.getDebate(debateId)
      if (get().debateId !== debateId) return
      let state = get()
      for (const event of events) {
        if (event.seq > state.lastSeq) state = reduceEvent(state, event, true)
      }
      const settled = !ACTIVE_STATUSES.has(debate.status)
      set({
        ...state,
        meta: { ...state.meta, ...debate },
        agents: settled ? resetStatuses(state.agents) : state.agents,
      })
    } catch {
      return
    }
  },

  async cancel() {
    const { debateId } = get()
    if (!debateId) return
    try {
      await api.cancelDebate(debateId)
    } catch (error) {
      set({ loadError: error })
    }
  },
}))

export const isActive = (meta) => Boolean(meta && ACTIVE_STATUSES.has(meta.status))
