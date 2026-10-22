from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.graph.debate_nodes import opening_node, rebuttal_node
from app.graph.judge_nodes import (
    conflicts_node,
    convergence_node,
    intake_node,
    route_after_convergence,
    ruling_node,
    verdict_node,
)
from app.graph.state import DebateState


def build_graph():
    graph = StateGraph(DebateState)
    graph.add_node("intake", intake_node)
    graph.add_node("opening", opening_node)
    graph.add_node("rebuttal", rebuttal_node)
    graph.add_node("conflicts", conflicts_node)
    graph.add_node("ruling", ruling_node)
    graph.add_node("convergence", convergence_node)
    graph.add_node("verdict", verdict_node)

    graph.add_edge(START, "intake")
    graph.add_edge("intake", "opening")
    graph.add_edge("opening", "conflicts")
    graph.add_edge("rebuttal", "conflicts")
    graph.add_edge("conflicts", "ruling")
    graph.add_edge("ruling", "convergence")
    graph.add_conditional_edges(
        "convergence", route_after_convergence, {"rebuttal": "rebuttal", "verdict": "verdict"}
    )
    graph.add_edge("verdict", END)
    return graph.compile(checkpointer=MemorySaver())
