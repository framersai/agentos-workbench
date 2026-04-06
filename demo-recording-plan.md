# AgentOS Workbench Demo Recording Plan

> Instructions for recording 7 demo videos for the agentos.sh marketing site.
> Each demo runs in the AgentOS Workbench (`apps/agentos-workbench/`).

---

## Setup Before Recording

### Environment

- **Resolution:** 1920x1080, 60fps
- **Browser:** Chrome, hide bookmarks bar, clean tabs
- **Zoom:** 125% browser zoom so code/text is readable
- **Theme:** Dark mode (Workbench settings)
- **Cursor:** Install a cursor highlighter extension (e.g., "Cursor Highlight" Chrome extension)
- **No audio needed** — captions will be overlaid in post-production

### API Keys Required

Set these in the workbench `.env` before recording:

```bash
OPENAI_API_KEY=sk-...          # Required for all demos
ANTHROPIC_API_KEY=sk-ant-...   # Required for multi-agent demo
SERPER_API_KEY=...             # Required for web search tool demos
```

### Pre-Load Demo Data (for RAG + Memory demos)

Ingest these docs before recording demos 5 and 6:

```bash
# Clone some interesting public repos/docs for RAG ingestion
mkdir -p /tmp/demo-docs

# AgentOS own docs (meta — agent answers questions about itself)
cp -r docs/getting-started/ /tmp/demo-docs/
cp -r docs/orchestration/ /tmp/demo-docs/
cp -r docs/features/voice-pipeline.md /tmp/demo-docs/
cp -r docs/features/cognitive-memory.md /tmp/demo-docs/

# Or use any interesting markdown corpus:
# - A product's documentation
# - API reference pages
# - Technical blog posts
# - Research paper summaries
```

Then ingest via the RAG tab's upload zone before recording.

---

## Demo 1: Agent Playground — Live Conversation with Tools

**Duration:** 60-90 seconds
**Tab:** Playground
**Verified:** 963 lines, real streaming API, no placeholders

### Steps

1. Open Workbench → click **Playground** tab
2. In the left panel, select model: `openai:gpt-4o`
3. Type system instructions: `You are a research assistant. Use tools to find real information.`
4. In the tools selector, enable `web_search`
5. In the chat input, type: **"Search the web for the latest AI agent frameworks released in 2026 and summarize the top 3"**
6. Press Enter — show tokens streaming in real time
7. When `web_search` fires, pause briefly to show the tool call expanding in the chat (collapsible section with args + result)
8. Wait for the full response
9. Click the **Session Inspector** panel on the right → show tool call details, latency numbers, token usage
10. Type a follow-up: **"Compare their GitHub star counts"** — show the agent remembering context

### Captions

| Timestamp | Caption                                    |
| --------- | ------------------------------------------ |
| 0-5s      | Select model and set instructions          |
| 5-12s     | Enable the web_search tool                 |
| 12-20s    | Ask a research question                    |
| 20-35s    | Tokens stream in real time                 |
| 35-45s    | Tool call fires — inspect args and results |
| 45-60s    | Agent synthesizes a structured answer      |
| 60-70s    | Session Inspector: latency, tokens, cost   |

### Why This Demo Matters

Shows the core agent loop: persona + streaming + automatic tool calling + real-time inspection. This is the first thing every visitor wants to see.

---

## Demo 2: Multi-Agent Agency — Seat-Based Coordination

**Duration:** 90-120 seconds
**Tabs:** Agency + Sidebar + Compose
**Verified:** Agency creation is real, and agency workflow execution streams through the backend. The separate Strategy tab is not wired into Agency launch.

> Important: do **not** record this as a debate demo in the current build. There is no strategy dropdown in the Agency flow, no rounds control, no dedicated judge field, and no inline role-instruction form on the main Agency screen. Those expectations are stale.

### Steps

1. Click **Agency** tab
2. In **New agency**, set agency name: `AI Legal Personhood Tribunal`
3. In the **Shared goal** field, type: **"Should autonomous AI agents be granted legal personhood to enter contracts and own intellectual property?"**
4. Add 3 seats using the seat assignment form:
   - `constitutional-lawyer`
   - `ai-startup-founder`
   - `digital-rights-activist`
5. Assign personas to each seat. If a workflow definition is available, optionally select one, but keep the focus on the seat roster and shared goal.
6. Click **Launch agency**
7. Open the **Sidebar** → click **+** to create a new session
8. Choose **Agency**, select `AI Ethics Review Board`, and click **Create**
9. Switch to the **Compose** tab. The agency session should show the **Agency Composer** instead of the normal request composer.
10. In markdown mode, enter:

```text
[Constitutional-Lawyer] Analyze legal precedents — corporate personhood, the EU AI Act, and liability frameworks. Argue that existing law already handles this without a new category.
[AI-Startup-Founder] Argue FOR legal personhood. Cite real bottlenecks: AI can't sign NDAs, hold patents, or be party to SLAs. Show how this blocks billion-dollar markets.
[Digital-Rights-Activist] Argue AGAINST. Raise accountability gaps, labor displacement, and the risk of corporations hiding behind AI "persons" to dodge liability. Cite specific cases.
```

11. Click **Start Agency Workflow**
12. Show the real-time agency updates in the right-side inspector: seat activity, streamed outputs, and agency/session state
13. If useful, briefly open the **Agency** tab again to show the saved collective and live seat status

### Captions

| Timestamp | Caption                                   |
| --------- | ----------------------------------------- |
| 0-10s     | Create the AI Legal Personhood Tribunal   |
| 10-25s    | Add 3 expert seats: lawyer, founder, activist |
| 25-40s    | Create an agency session from the sidebar |
| 40-55s    | Switch to Compose and use Agency Composer |
| 55-80s    | Start workflow and watch seat updates     |
| 80-100s   | Inspect live agency state and outputs     |

### Why This Demo Matters

It still shows real multi-agent coordination, but it matches the product that actually ships today: create an agency, open an agency session, and run a coordinated workflow with multiple seats.

---

## Demo 3: Graph Builder — Build, Run & Inspect Agent Workflows

**Duration:** 90-120 seconds
**Tab:** Graph Builder (top nav row 3)
**What's on screen:** Workflow Graph Builder with palette, canvas, YAML view, Node Editor sidebar, Compile/Run controls, and persisted Runtime Runs.

### Pre-requisite

Have at least one prior workflow or agency run completed so the **Runtime Runs** tab has persisted data to show. Running Demo 2 (Multi-Agent Agency) beforehand is ideal — it produces completed agency and workflow runs.

### Steps

1. Click the **Graph Builder** tab in the top navigation
2. Note the status badges: **GRAPH BUILDER MIXED**, **RUNTIME CONNECTED**, **PERSISTED RUNS** — pause briefly so they're visible
3. In the **Palette** (left side), click **GMI** to add a node → in the **Node Editor** (right side), set Label to "Draft Content" and type instructions: `Write a short blog post about AI agents`
4. Click **Tool** in the palette to add a second node → set Label to "Web Research", set ToolName to `web_search`, set Args to `{"query": "AI agent frameworks 2026"}`
5. Click **Human** in the palette → set Label to "Final Approval"
6. Click **Guardrail** in the palette → set Label to "Safety Check"
7. Wire up the graph using the **Connects To** checkboxes in each node's editor:
   - Click the "Draft Content" node on the canvas → in its Node Editor, check the **Tool 1** checkbox under Connects To
   - Click the "Web Research" node → check the **Guardrail 1** checkbox
   - Click the "Safety Check" node → check the **Human 1** checkbox
8. Pause to show the complete graph on the canvas — a 4-node pipeline with GMI → Tool → Guardrail → Human
10. Switch to the **YAML** tab (next to Canvas) → show the auto-generated workflow definition
11. Switch back to **Canvas**, click **Compile** → show the workflow compiling
12. Click **Run** → show the workflow executing
13. Click **Checkpoint** to save the current graph as a local snapshot
14. Switch to the **Local Snapshots** tab → show the saved snapshot (stored in browser session only)
15. Switch to the **Runtime Runs** tab → show the list of persisted runs with status badges (COMPLETED)
16. Click on a run entry → show the run detail sidebar with: graph name, checkpoint count, task count, timestamps, and status

### Captions

| Timestamp | Caption                                                |
| --------- | ------------------------------------------------------ |
| 0-10s     | Graph Builder with live runtime connection             |
| 10-25s    | Add nodes from palette: GMI, Tool, Guardrail, Human    |
| 25-40s    | Configure: GMI instructions, Tool name + args          |
| 40-55s    | Wire connections via Connects To checkboxes             |
| 55-65s    | YAML tab: auto-generated workflow definition           |
| 65-80s    | Compile and Run the workflow                           |
| 80-100s   | Runtime Runs: inspect persisted runs and checkpoints   |

### Why This Demo Matters

Shows the full workflow lifecycle in one screen: visually author a graph with diverse node types (LLM, tools, routers, guardrails, human-in-the-loop), compile it, run it against a live runtime, and then inspect persisted run history with checkpoints. The combination of visual authoring + runtime execution + run inspection in a single view is unique.

---

## Demo 4: Emergent Tool Forge — Agent Creates Its Own Tools

**Duration:** 90-120 seconds
**Tab:** Tool Forge
**Verified:** 738 lines, real API calls to `/api/agency/forge`, fallback stubs for judge

### Steps

1. Click **Tool Forge** tab
2. In the **Forge** sub-tab, type in the description field: **"A tool that fetches the current price of any cryptocurrency from CoinGecko"**
3. (Optional) Add a JSON schema hint for parameters
4. Click **Forge** — show the LLM generating:
   - Tool name
   - Description
   - Input schema
   - Implementation code
5. Switch to **Verdicts** sub-tab — show the Judge scores:
   - Correctness %
   - Safety %
   - Efficiency %
   - Reasoning text
6. Switch to **Test Runner** sub-tab
7. Select the forged tool, input: `{"symbol": "bitcoin"}`
8. Click Run — show the sandboxed execution result
9. Switch to **Registry** sub-tab — show the tool in the Session tier
10. Click **Promote** (if available) to move it to Agent tier
11. Go back to **Playground** tab, ask: **"What's the current price of Ethereum?"**
12. Show the agent discovering and calling the newly forged tool

### Captions

| Timestamp | Caption                                             |
| --------- | --------------------------------------------------- |
| 0-10s     | Describe the tool you need in plain English         |
| 10-25s    | LLM generates name, schema, and implementation      |
| 25-40s    | LLM-as-judge evaluates correctness and safety       |
| 40-55s    | Test with real inputs in sandboxed environment      |
| 55-70s    | Promote to agent registry                           |
| 70-90s    | Agent discovers and uses the new tool automatically |

### Why This Demo Matters

An AI creating its own tools at runtime, having them judge-evaluated, then immediately using them — this is the emergent capabilities selling point that no one else demos.

---

## Demo 5: RAG Pipeline — Ingest, Search, Evaluate

**Duration:** 90-120 seconds
**Tabs:** RAG (3 sub-panels) → Evaluation
**Verified:** 2,092 lines across 4 components, real forms, drag-and-drop upload

### Pre-requisite

Ingest documents before recording (see Setup section above). Recommended docs to ingest for an impressive demo:

**Option A — AgentOS docs (self-referential, impressive):**

- `docs/getting-started/quickstart.md`
- `docs/getting-started/high-level-api.md`
- `docs/orchestration/decision-guide.md`
- `docs/features/cognitive-memory.md`
- `docs/features/voice-pipeline.md`
- `docs/features/building-voice-agents.md`

**Option B — Any public technical docs:**

- React docs (react.dev markdown exports)
- Next.js docs
- Any API reference you find interesting

**Option C — Research papers (most impressive for technical audience):**

- Download 3-5 PDF papers on RAG, agent architectures, or memory systems from arXiv
- The RAG tab supports PDF ingestion

### Steps

1. Click **RAG** tab
2. In the **Upload** sub-tab of RagDocumentManager:
   - Drag 3-5 markdown/PDF files into the upload zone
   - Show the chunking progress (chunk count updates in real time)
   - Show the embedding count after processing
3. Switch to **Search** sub-tab
4. Type a query: **"How does the memory system handle personality-driven encoding?"**
5. Show retrieved chunks with:
   - Relevance scores (0.0-1.0)
   - Source file highlighting
   - Chunk text preview
6. In RagConfigPanel (left), change retrieval strategy:
   - Switch from **vector** to **HyDE** → re-run search, show different results
   - Switch to **GraphRAG** → show graph-expanded results
7. Switch to **Evaluation** tab
8. Show the test dataset (10 pre-loaded questions or create a few)
9. Click **Run Evaluation** — show pass/fail per question
10. Show the comparison view if available (baseline vs challenger)

### Captions

| Timestamp | Caption                                      |
| --------- | -------------------------------------------- |
| 0-12s     | Drag documents into the RAG pipeline         |
| 12-22s    | Automatic chunking and vector embedding      |
| 22-38s    | Semantic search with relevance scores        |
| 38-55s    | Switch strategies: Vector → HyDE → GraphRAG  |
| 55-72s    | Run evaluation suite against test dataset    |
| 72-90s    | Pass/fail breakdown with scores per question |

### Why This Demo Matters

Multi-strategy retrieval comparison + evaluation framework shows production-readiness. The side-by-side strategy comparison is something competitors don't show.

---

## Demo 6: Memory Dashboard — Cognitive Mechanisms

**Duration:** 60-90 seconds
**Tab:** Memory (3 sub-views)
**Verified:** 1,333 lines across 4 components, real memory store, rich visualization

### Pre-requisite

Have a few conversations in the Playground first so the memory system has data to display. At least 5-10 messages across 2 sessions.

### Steps

1. Click **Memory** tab
2. In the **Overview** sub-tab, show:
   - 4 memory tier cards: working, episodic, semantic, procedural
   - Token saturation indicators (green/yellow/red health dots)
   - List of 8 cognitive mechanisms
3. Click on a mechanism name to see its description
4. Show the HEXACO personality sliders (if visible) — explain how they affect memory
5. Switch to **Timeline** sub-tab:
   - Show the operation timeline: WRITE, RETRIEVE, CONSOLIDATE events
   - Filter by category (episodic, semantic)
   - Show timestamps and relative time
6. Switch to **Inspector** sub-tab:
   - Click on a memory entry
   - Show confidence scoring badge
   - Show source information
   - Show the entry content

### Captions

| Timestamp | Caption                                      |
| --------- | -------------------------------------------- |
| 0-12s     | 4 memory tiers with health indicators        |
| 12-25s    | 8 neuroscience-grounded cognitive mechanisms |
| 25-40s    | HEXACO personality modulates memory behavior |
| 40-55s    | Timeline: watch memory operations over time  |
| 55-70s    | Inspector: drill into any memory entry       |

### Why This Demo Matters

No other framework has personality-driven memory with neuroscience backing. The tier health indicators and operation timeline are visually striking.

---

## Demo 7: Capability Discovery — Browse, Search & Assign

**Duration:** 45-60 seconds
**Tab:** Capabilities
**Verified:** 502 lines, real API with graceful fallback, search with debounce

> **Pre-requisite:** The capability browser scans `~/.wunderland/capabilities/` for `CAPABILITY.yaml` files and also pulls from the workbench tool/skill/extension registries. Before recording, make sure you have run at least one Playground session with tools enabled (so `web_search` etc. appear in the registry), or seed capability files manually.

### Steps

1. Click **Capabilities** tab
2. Show the default state: the **Capability Browser** panel with the **Mixed Discovery** badge and **Runtime Connected** status
3. Show the kind filter pills: **All**, **Tools**, **Skills**, **Extensions**, **Channels** — click through a few to show the filtering
4. In the search box, type: **"web search"** — show the debounced search returning matching capabilities as cards
5. Point out the card anatomy: kind icon, **tier badge** (T0/T1/T2), kind pill, and description
6. Click the **chevron** on a result card to expand it → show the **Schema** panel with full JSON input parameters, the **Usage Example** snippet, and **Dependencies** list
7. If a tool card has a **Try It** button, click it to open the **dry-run panel** — enter sample JSON input and show the inline execution result
8. Click **Refresh** to re-fetch from the backend
9. Show the **result count footer** at the bottom
10. (Optional) If an agency is active in the sidebar, show the **"Assign to agency"** button on a card — click it to assign the capability, then show it dimmed with the "Assigned to agency" label

### Captions

| Timestamp | Caption                                          |
| --------- | ------------------------------------------------ |
| 0-8s      | Capability Browser with live runtime connection  |
| 8-18s     | Filter by kind: Tools, Skills, Extensions        |
| 18-28s    | Search by keyword with debounced results         |
| 28-38s    | Expand a card: schema, usage example, tier badge |
| 38-48s    | Try It: dry-run a tool directly from the browser |
| 48-55s    | Assign capabilities to an active agency          |

### Why This Demo Matters

Shows a unified catalogue for all capability types with inline schema inspection and one-click dry-run testing — developers can discover, test, and wire up tools without leaving the browser.

---

## Priority Order

| #   | Demo                 | Visual Impact | Recording Difficulty              | Record First? |
| --- | -------------------- | ------------- | --------------------------------- | ------------- |
| 1   | Agent Playground     | High          | Easy — just chat                  | Yes           |
| 2   | Multi-Agent Debate   | Very High     | Medium — setup 3 agents           | Yes           |
| 3   | Graph Builder        | High          | Easy — click palette + connect    | Yes           |
| 4   | Tool Forge           | Very High     | Medium — needs API                | After 1-3     |
| 5   | RAG Pipeline         | High          | Medium — needs docs ingested      | After 1-3     |
| 6   | Memory Dashboard     | Medium        | Hard — needs conversation history | Last          |
| 7   | Capability Discovery | Medium        | Easy — needs seeded capabilities  | After 1-3     |

**Record demos 1, 2, 3 first** — easiest setup, highest impact. Then 4 and 5. Save 6 for last since it needs the most pre-loaded data.

---

## Video File Destinations

After recording, place the files here for the marketing site to pick them up:

```
apps/agentos.sh/public/videos/
├── streaming.mp4          ← Demo 1 (replace existing)
├── agent-creation.mp4     ← Demo 2 (replace existing)
├── multi-agent.mp4        ← Demo 2 (replace existing)
├── rag-memory.mp4         ← Demo 5 (replace existing)
├── planning-engine.mp4    ← Demo 3 or 4 (replace existing)
```

Keep each video under 5 MB. Use HandBrake or ffmpeg to compress:

```bash
ffmpeg -i input.mp4 -vcodec libx264 -crf 28 -preset slow -vf scale=1920:1080 output.mp4
```

---

## Checklist

- [ ] Set up API keys (OpenAI, Anthropic, Serper)
- [ ] Set browser to 125% zoom, dark mode
- [ ] Install cursor highlighter extension
- [ ] Pre-ingest documents for RAG demo
- [ ] Have 5-10 conversation messages for Memory demo
- [ ] Record Demo 1: Agent Playground
- [ ] Record Demo 2: Multi-Agent Debate
- [ ] Record Demo 3: Graph Builder
- [ ] Record Demo 4: Tool Forge
- [ ] Record Demo 5: RAG Pipeline
- [ ] Record Demo 6: Memory Dashboard
- [ ] Record Demo 7: Capability Discovery
- [ ] Compress all videos to < 5 MB each
- [ ] Place in `apps/agentos.sh/public/videos/`
- [ ] Test on agentos.sh locally
