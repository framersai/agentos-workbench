# AgentOS Client Workbench

React + Vite dashboard for inspecting AgentOS sessions locally. The goal is to give builders a zero-config cockpit that mirrors how Frame.dev debugs adaptive agents.

## Highlights

- Sidebar session switcher backed by a lightweight zustand store
- Timeline inspector that renders streaming @agentos/core chunks with colour-coded context
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

## Local persistence

- Personas/agencies are cached to `localStorage` so you can restart the dev server without losing your catalog.
- Session timelines remain in-memory to avoid leaking production transcripts on shared machines.

## Wiring it up

1. Copy `.env.example` → `.env.local` (or set env vars in your shell) and point the workbench at your backend:
   ```ini
   VITE_AGENTOS_BASE_URL=http://localhost:3001/agentos
   VITE_AGENTOS_STREAM_PATH=/stream
   ```
   Leave them unset if you proxy through `/api/agentos`.
2. In the backend, ensure `AGENTOS_ENABLED=true` (and any provider keys) so `/agentos/*` routes are exposed.
3. Start the backend (`pnpm --filter backend dev`) and then run the workbench (`pnpm --filter @wearetheframers/agentos-client dev`).
4. Use the request composer to fire a turn—live `AGENCY_UPDATE` / `WORKFLOW_UPDATE` chunks will populate the timeline automatically.

The client mirrors the streaming contracts from `@agentos/core`, so backend responses flow straight into the UI with no reshaping.

## Links
- Website: https://frame.dev
- AgentOS: https://agentos.sh
- Marketplace: https://vca.chat
- GitHub: https://github.com/framersai/agentos-client
- npm: https://www.npmjs.com/org/framers
## Contributing & Security
- Contributing: ./\.github/CONTRIBUTING.md
- Code of Conduct: ./\.github/CODE_OF_CONDUCT.md
- Security Policy: ./\.github/SECURITY.md
