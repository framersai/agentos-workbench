# AgentOS Client Workbench

React + Vite dashboard for inspecting AgentOS sessions locally. The goal is to give builders a zero-config cockpit that mirrors how Frame.dev debugs adaptive agents.

## GMIs, Agents, and Agency

- GMIs (Generalised Mind Instances) package persona prompts, memory policies, tool permissions, language preferences, and guardrail hooks into reusable minds.
- Agents wrap GMIs for product surfaces (labels, icons, availability) while preserving the GMI’s cognition and policy.
- Agencies coordinate multiple GMIs (and humans) via workflows; the workbench visualises `WORKFLOW_UPDATE` and `AGENCY_UPDATE` events in the timeline.

Benefits:
- Cohesive cognition: one unit to version, export, and reuse across apps
- Guardrail-first: policy decisions are streamed and auditable
- Portable: same GMI across cloud/desktop/mobile/browser (capability-aware)

## Highlights

- Sidebar session switcher backed by a lightweight zustand store
- Timeline inspector that renders streaming @agentos/core chunks with color-coded context
- Request composer for prototyping turns or replaying transcripts (wire it to your backend when ready)
- Dark, neon-drenched UI that matches the Frame.dev production command centre

## Scripts

```bash
pnpm dev       # launch Vite dev server on http://localhost:5175
pnpm build     # production build (emits dist/)
pnpm preview   # preview the built app
pnpm lint      # eslint
pnpm typecheck
```

## Storage, export, and import

- Data is stored locally in your browser using IndexedDB (no server writes).
- Stored: personas (remote + local), agencies, and sessions (timeline events).
- Export per-session from the timeline header: "Export session", "Export agency", "Export workflow".
- Export everything from Settings → Data → "Export all" (also available in the timeline).
- Import from Settings → Data → "Import…" (schema: `agentos-client-export-v1`).
- Clear local data from Settings → Data → "Clear storage" (export first if needed).

See [`docs/CLIENT_STORAGE_AND_EXPORTS.md`](../../docs/CLIENT_STORAGE_AND_EXPORTS.md) for details.

## Wiring it up

1. Copy `.env.example` → `.env.local` (or set env vars in your shell) and point the workbench at your backend:

   ```ini
   VITE_AGENTOS_BASE_URL=http://localhost:3001/agentos
   VITE_AGENTOS_STREAM_PATH=/stream
   ```

   Leave them unset if you proxy through `/api/agentos`.
2. In the backend, ensure `AGENTOS_ENABLED=true` (and any provider keys) so `/agentos/*` routes are exposed.
3. Start the backend (`pnpm --filter backend dev`) and then run the workbench (`pnpm --filter @framersai/agentos-client dev`).
4. Use the request composer to fire a turn—live `AGENCY_UPDATE` / `WORKFLOW_UPDATE` chunks will populate the timeline automatically.

The client mirrors the streaming contracts from `@agentos/core`, so backend responses flow straight into the UI with no reshaping.

### Onboarding

- A first-run guided tour highlights tabs and controls. You can "Remind me later" or "Don't show again" (saved locally).

## AgentOS HTTP endpoints (quick list)

- `POST /api/agentos/chat` — send a turn (messages, mode, optional workflow)
- `GET  /api/agentos/stream` — SSE stream for incremental updates
- `GET  /api/agentos/personas` — list personas (filters: capability, tier, search)
- `GET  /api/agentos/workflows/definitions` — list workflow definitions
- `POST /api/agentos/workflows/start` — start a workflow

See `docs/BACKEND_API.md` for complete request/response shapes and examples.

## Licensing

- AgentOS core (`@agentos/core`) — Apache 2.0
- Marketplace and site components — MIT (vca.chat is the public marketplace we operate)

## Links

- Website: https://agentos.sh
- Frame: https://frame.dev
- Marketplace: https://vca.chat
- GitHub: https://github.com/framersai/agentos
- NPM: https://www.npmjs.com/package/@framers/agentos, https://www.npmjs.com/package/@framers/sql-storage-adapter
