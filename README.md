# Agora

**Where AI argues before it answers.**

Agora is a multi-agent debate app. You pick a topic and ask a question. Instead of answering straight away, a panel of AI debaters argues it out in the open. They rebut each other, fact-check each other with live web evidence, and answer to a Judge who rules on every dispute, scores every argument, and punishes weak ones. Only after the debate has converged does the Judge deliver a verdict.

This README is the same file in `backend/` and `frontend/`. It covers the whole project. Commands below assume you start from the project root.

<p align="center">
  <img src="../docs/screenshots/landing.png" alt="Agora landing screen with topic selector and question input" width="860">
</p>

## How a debate works

<p align="center">
  <img src="../docs/workflow.svg" alt="Agora debate workflow" width="100%">
</p>

1. **Question analysis.** The Judge restates the question, lists the claims that decide it, gives each debater a distinct angle, and can add a domain specialist chosen for the question.
2. **Opening statements.** Every debater picks a stance, searches the web, and argues with cited sources.
3. **Conflict detection.** The Judge maps who disagrees with whom and sets the speaking order for the next round.
4. **Ruling.** The Judge scores logic, evidence and relevance, rules on each conflict, and hands out warnings, penalties and rewards.
5. **Convergence check.** The debate loops through cross-examination until at least the minimum number of rounds is done and the Judge says positions have settled.
6. **Final verdict.** Winning and rejected arguments, remaining uncertainty, confidence, and final standings.

The panel: the Judge, The Empiricist, The Logician, The Philosopher, The Historian, The Skeptic, The Pragmatist, and an optional dynamic specialist. Each debater has its own persona, bias, fighting style, and its own model and API key.

## Screenshots

### Live debate: the arena, the feed and the Judge

The graph shows every agent as a node. Edges animate when agents rebut, agree, accuse or get ruled on. Cream edges are Judge rulings, tinted edges are agent-to-agent actions, and dashed edges mark unverified claims.

<p align="center">
  <img src="../docs/screenshots/judge-turn-order-and-rulings.png" alt="Live debate with the graph, the credibility scoreboard and the Judge's turn order and conflict report" width="100%">
</p>

### Fallacy call-outs

Debaters name logical fallacies, quote the claim, and cite web evidence inline. Each source chip opens the page it came from.

<p align="center">
  <img src="../docs/screenshots/fallacy-callouts.png" alt="A rebuttal message with inline citations and fallacy call-outs against two other agents" width="560">
</p>

### The Judge disciplines the panel

The Judge reprimands, penalizes and rewards in real time. Scores move on the scoreboard, and the penalized agent's node shakes. When the debate converges, a verdict card appears in the feed.

<p align="center">
  <img src="../docs/screenshots/judge-discipline-and-verdict-card.png" alt="A Judge reprimand with a score penalty, the convergence note and the verdict card" width="100%">
</p>

### Click any agent

Select a node or a scoreboard row to see that agent's persona, bias, fighting style, assigned focus, model, credibility history, and its full exchange with every other agent.

<p align="center">
  <img src="../docs/screenshots/agent-detail.png" alt="Agent detail panel with persona, credibility chart and communication history" width="100%">
</p>

### The verdict

A cream verdict card with the headline answer, confidence, consensus level, the arguments that won and the ones rejected, what remains uncertain, key sources, and final standings.

<p align="center">
  <img src="../docs/screenshots/verdict.png" alt="Final verdict card for the Islam versus Christianity question" width="100%">
</p>

### Mobile

<p align="center">
  <img src="../docs/screenshots/landing-mobile.png" alt="Agora landing screen on a phone" width="300">
</p>

## Features

- **Live graph** of agents and their interactions (React Flow), with animated edges, speaking pulses, and shake and flash effects on penalties.
- **Live feed** with thinking, searching and waiting indicators, inline citations, and each message's stance and unverified flag.
- **Evidence tab** listing every source found, and which agent found it.
- **The bench tab** with conflicts, who the Judge ruled correct, and per-round evaluations.
- **Confront the Judge.** A debater can accuse the Judge of bias or an unfair score. The Judge answers at once, and may uphold, partly uphold or reject the challenge, with a score change.
- **History.** Every debate is saved and can be reopened or deleted.
- **Resilient by design.** Slow agents are waited for, never skipped. Rate limits and network errors retry with exponential backoff. A failed web search is flagged as unverified and the debate continues. If the connection drops, the UI reconnects and catches up from where it left off.
- **Structured logs** in JSON, with separate application, agent, web-search and error files, and a correlation id per debate and per turn.

## Samples

Questions that work well:

- Does God exist?
- Islam vs. Christianity: which religion is better overall?
- Is it acceptable to kill animals for food when vegan options are plentiful?
- Will AI recursively improve itself and become an existential risk?
- Do humans have free will?
- Is universal basic income a good idea?

Sample verdict headlines from real runs:

> Neither Islam nor Christianity can be proven objectively superior overall, as the debate exposes an intractable tension between empirical socio-economic developmental metrics and foundational theological-legal frameworks. *(confidence 65%, contested)*

> The moral permissibility of killing animals for food is irreducibly contested between plant-based nutritional adequacy and the severe socioeconomic disruptions of global dietary shifts.

## Quick start

You need Python 3.11+ and Node 20.19+ (or 22+).

```bash
cp .env.example .env
```

Fill in `.env` (see below), then run the two halves in separate terminals.

**Backend** (API and WebSocket on port 8000):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

Run it with the virtual environment's Python. Starting it with a different Python gives `ModuleNotFoundError: No module named 'structlog'`.

**Frontend** (UI on port 5173, proxies `/api` and `/ws` to the backend):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. API docs are at http://localhost:8000/docs.

To point the UI at a backend on another port, start Vite with `AGORA_BACKEND_URL=http://localhost:8003 npm run dev`. For a production build, run `npm run build`, and set `VITE_API_BASE` and `VITE_WS_BASE` if the API is on a different origin.

### Run with Docker

With Docker and Docker Compose installed, from the project root:

```bash
cp .env.example .env
docker compose up --build
```

Open http://localhost:8080. The web container serves the UI and proxies `/api` and `/ws` to the backend container. The backend is also published on `127.0.0.1:8000` for the API docs. Debates and logs are kept in the `agora-data` and `agora-logs` volumes. Stop with `docker compose down`, or add `-v` to delete the stored data too.

## Configuration

Everything is configured in `.env` at the project root. Keys are never hard-coded.

Each agent has its own provider, model and API key:

| Slot | Role |
|---|---|
| `JUDGE` | The Judge |
| `AGENT_1` | The Empiricist |
| `AGENT_2` | The Logician |
| `AGENT_3` | The Philosopher |
| `AGENT_4` | The Historian |
| `AGENT_5` | The Skeptic |
| `AGENT_6` | The Pragmatist |
| `AGENT_7` | Optional dynamic domain specialist. Leave the key empty to turn it off. |

For each slot you can set `<SLOT>_PROVIDER`, `<SLOT>_MODEL`, `<SLOT>_API_KEY`, and optionally `<SLOT>_BASE_URL`, `<SLOT>_TEMPERATURE`, `<SLOT>_MAX_TOKENS` and `<SLOT>_MAX_INPUT_TOKENS`.

Supported providers: `anthropic`, `openai`, `google`, `groq`, and OpenAI-compatible ones: `openrouter`, `together`, `deepseek`, `xai`, `mistral`, `perplexity`.

```env
JUDGE_PROVIDER=google
JUDGE_MODEL=gemini-2.5-flash-lite
JUDGE_API_KEY=your-key

AGENT_1_PROVIDER=groq
AGENT_1_MODEL=openai/gpt-oss-120b
AGENT_1_API_KEY=your-key
AGENT_1_MAX_INPUT_TOKENS=6000

TAVILY_API_KEY=your-key
```

Other useful settings:

| Variable | What it does | Default |
|---|---|---|
| `TAVILY_API_KEY` | Web search for evidence. Without it every argument is flagged unverified. | empty |
| `MIN_ROUNDS` / `MAX_ROUNDS` | Minimum cross-examination rounds before the Judge may converge, and the hard cap. | 2 / 4 |
| `LLM_TIMEOUT_SECONDS` | How long to wait for a slow agent. | 600 |
| `LLM_MAX_RETRIES` | Retries on rate limits and network errors. | 6 |
| `PARALLEL_OPENINGS` / `PARALLEL_REBUTTALS` | Run turns in parallel. | true / false |
| `<SLOT>_MAX_INPUT_TOKENS` | Shrinks the transcript to fit providers with small per-request limits, such as Groq's free tier. | unlimited |
| `CORS_ORIGINS` | Allowed browser origins. | localhost:5173 |

Model availability changes. If a model returns "not found" or "no longer available" for your key, change its `_MODEL` value. Keep `.env` out of version control.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Status and which API keys are missing |
| `GET` | `/api/config` | The panel and server limits |
| `POST` | `/api/debates` | Start a debate with `question` and `topic` |
| `GET` | `/api/debates` | List saved debates |
| `GET` | `/api/debates/{id}` | A debate's details and full event history |
| `POST` | `/api/debates/{id}/cancel` | Adjourn a running debate |
| `DELETE` | `/api/debates/{id}` | Delete a debate |
| `WS` | `/ws/debates/{id}?after=N` | Live event stream, replaying anything after event `N` |

Errors come back in one shape: `{"error": {"code", "message", "details", "request_id"}}`.

## Logs and data

- Logs are written to `backend/logs/` as `agora-app.log`, `agora-agents.log`, `agora-search.log` and `agora-errors.log`. They are JSON and rotate automatically. Agent logs include latency, token counts, retries and failures per call.
- Debates are saved in `backend/data/debates/`. A debate that was running when the server stopped shows up as interrupted.

## Built with

**Backend:** FastAPI, LangGraph, LangChain, Tavily, Pydantic, tenacity, structlog.
**Frontend:** React, Vite, Tailwind CSS, React Flow, Framer Motion, Zustand.

The whole UI is built on two brand colors, Blueberry (`#2C3B8A`) and Cream Soda (`#FDF0C8`). Every color is a token in `frontend/src/theme/theme.css`, and components use only those tokens.

## About the agents' tone

Debaters are written to fight hard: they can be heated, sarcastic and crude, and the Judge can lose its temper. Prompts live in `backend/app/agents/prompts.py` and the personas in `backend/app/agents/personas.py`. Which models actually swear depends on the model. Some providers soften it on their own.

## Project policies

[MIT License](../LICENSE) · [Privacy](../PRIVACY.md) · [Security](../SECURITY.md) · [Contributing](../CONTRIBUTING.md) · [Code of Conduct](../CODE_OF_CONDUCT.md)
