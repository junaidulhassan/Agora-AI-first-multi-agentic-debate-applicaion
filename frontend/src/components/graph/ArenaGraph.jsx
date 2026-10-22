import { useEffect, useMemo } from 'react'
import { Controls, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import AgentNode from './AgentNode.jsx'
import InteractionEdge from './InteractionEdge.jsx'
import GraphLegend from './GraphLegend.jsx'
import { INTERACTION_LABELS, JUDGE_KINDS } from '../../lib/format.js'
import { useNow } from '../../lib/hooks.js'
import { isActive, useDebate } from '../../store/debateStore.js'

const nodeTypes = { agent: AgentNode }
const edgeTypes = { interaction: InteractionEdge }
const RECENT_MS = 6500

function layoutNodes(agentOrder, agents) {
  const debaters = agentOrder.filter((id) => agents[id]?.role !== 'judge')
  const radiusX = Math.max(300, debaters.length * 52)
  const radiusY = Math.max(165, debaters.length * 25)
  const nodes = [
    {
      id: 'judge',
      type: 'agent',
      position: { x: -72, y: -52 },
      data: { agentId: 'judge' },
    },
  ]
  debaters.forEach((id, index) => {
    const angle = (-90 + (360 / debaters.length) * index) * (Math.PI / 180)
    nodes.push({
      id,
      type: 'agent',
      position: { x: Math.cos(angle) * radiusX - 60, y: Math.sin(angle) * radiusY - 40 },
      data: { agentId: id },
    })
  })
  return nodes
}

function buildEdges(interactions, agents, selectedId, now) {
  const grouped = new Map()
  interactions.forEach((interaction) => {
    if (!agents[interaction.source] || !agents[interaction.target]) return
    const key = `${interaction.source}|${interaction.target}|${interaction.kind}`
    const entry = grouped.get(key) ?? { count: 0, latest: interaction }
    entry.count += 1
    entry.latest = interaction
    grouped.set(key, entry)
  })
  return [...grouped.entries()].map(([key, { count, latest }]) => {
    const fromJudge = JUDGE_KINDS.has(latest.kind) || latest.source === 'judge'
    const color = fromJudge ? 'var(--agent-judge)' : `var(--${agents[latest.source].color_token})`
    const touchesSelected = selectedId && (latest.source === selectedId || latest.target === selectedId)
    return {
      id: key,
      source: latest.source,
      target: latest.target,
      type: 'interaction',
      selectable: false,
      data: {
        kind: latest.kind,
        color,
        count,
        fromJudge,
        summary: latest.summary,
        unverified: latest.unverified,
        recent: latest.at > 0 && now - latest.at < RECENT_MS,
        dimmed: Boolean(selectedId) && !touchesSelected,
        label: INTERACTION_LABELS[latest.kind],
      },
    }
  })
}

function Graph() {
  const agents = useDebate((state) => state.agents)
  const agentOrder = useDebate((state) => state.agentOrder)
  const interactions = useDebate((state) => state.interactions)
  const selectedId = useDebate((state) => state.selectedAgentId)
  const active = useDebate((state) => isActive(state.meta))
  const now = useNow(1000, active)
  const select = useDebate((state) => state.selectAgent)
  const { fitView } = useReactFlow()

  const orderKey = agentOrder.join('|')
  const nodes = useMemo(() => layoutNodes(agentOrder, useDebate.getState().agents), [orderKey])
  const edges = useMemo(() => buildEdges(interactions, agents, selectedId, now), [interactions, agents, selectedId, now])

  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.1, duration: 500 }), 60)
    return () => clearTimeout(timer)
  }, [agentOrder.length, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      minZoom={0.4}
      maxZoom={1.6}
      nodesConnectable={false}
      nodesDraggable={false}
      onNodeClick={(_, node) => select(useDebate.getState().selectedAgentId === node.id ? null : node.id)}
      elementsSelectable={false}
      preventScrolling={false}
      zoomOnScroll={false}
      proOptions={{ position: 'top-right' }}
      aria-label="Agent interaction graph"
    >
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  )
}

export default function ArenaGraph() {
  return (
    <section
      aria-label="Debate arena"
      className="glass-deep absolute inset-0 overflow-hidden rounded-3xl"
      style={{
        backgroundImage: 'radial-gradient(color-mix(in srgb, var(--text) 10%, transparent) 1px, transparent 1px)',
        backgroundSize: '26px 26px',
      }}
    >
      <ReactFlowProvider>
        <Graph />
      </ReactFlowProvider>
      <GraphLegend />
    </section>
  )
}
