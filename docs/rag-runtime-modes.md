# Workbench RAG Runtime Modes

AgentOS Workbench currently runs the RAG surface in a mixed mode. Some actions are backed by the live AgentOS runtime, while others still use the workbench's demo document library.

## Runtime prerequisites

- Set `OPENAI_API_KEY` for the workbench backend.
- Leave `AGENTOS_WORKBENCH_ENABLE_RUNTIME_RAG` unset, or set it to a truthy value.
- Start the backend from `apps/agentos-workbench/backend`.

When runtime retrieval is available, the workbench persists runtime RAG state under:

- `apps/agentos-workbench/backend/data/runtime-rag-vectors.json`
- `apps/agentos-workbench/backend/data/runtime-rag-documents.json`

## Current behavior

| Workbench action | Runtime-backed | Demo-backed fallback |
| --- | --- | --- |
| Text / markdown upload | Yes | Yes, when runtime is unavailable |
| URL ingest | Yes, for fetchable `http`/`https` pages with text-like content | Yes, when runtime is unavailable or URL fetch/extraction fails |
| PDF ingest | Yes, via `pdftotext` on the backend host | Yes, when runtime is unavailable, `pdftotext` is missing, or extraction fails |
| Upload with a selected runtime collection | Yes, and the document is attached during ingest | No |
| Upload with a selected demo collection | No, the upload stays on the demo library intentionally | Yes |
| Search (all docs) | Yes, when runtime is ready | Yes |
| Search scoped to a runtime collection | Yes | No |
| Search scoped to a demo collection | No | Yes |
| Runtime panel note ingest | Yes | No |
| Runtime panel query scoped to a runtime collection | Yes | No |
| Runtime collections | Yes | No |
| Demo collections | No | Yes |

Runtime file uploads now go through one multipart runtime route for text, markdown, and PDF inputs instead of separate live upload code paths per file type.

The runtime panel and document manager now share runtime collection and availability state, so runtime collection changes and runtime note ingest show up across the workspace without a manual refresh.

Runtime query results and successful runtime note ingest can also jump straight into the shared chunk viewer for the mirrored runtime document.

When a query result carries a chunk index, the chunk viewer now auto-selects, expands, and highlights that exact chunk instead of only opening the document-level list.

Reopening the same exact chunk now re-centers and re-expands it as a fresh highlight request, instead of silently staying where it was.

Manual document-level chunk navigation clears that highlight state, so the chunk viewer only stays highlighted when it was opened from a specific result-driven chunk jump.

When a chunk jump switches to a different document, the viewer now clears the previous chunk list immediately and shows a loading state instead of briefly rendering stale chunks from the old document.

The chunk viewer header now shows whether it was opened manually from the document list, from a document-manager search result, from a live runtime result, or from the last runtime note ingest.

Runtime query and search results now fall back to a clearly marked one-chunk preview when the matching runtime document is not mirrored into the workbench document registry. That keeps the shared chunk viewer useful without pretending the full mirrored document is available.

When the current runtime query/search result set contains multiple hits for the same unmirrored document, that preview now keeps those retrieved chunks together in the chunk viewer instead of collapsing back to a single match. The result action also shows the grouped hit count directly, for example `Preview 3 Hits`.

If that runtime document later appears in the mirrored workbench registry, the chunk viewer shows a `Load Full Doc` action so you can replace the preview with the full mirrored document while keeping the same result context.

Preview-only chunk views also expose `Refresh Mirror`, which checks that specific runtime document against the mirrored workbench registry instead of reloading the whole document workspace. If the runtime document is now mirrored, the header switches to `Mirror Ready` and keeps the explicit `Load Full Doc` action available so you can replace the preview deliberately. If it is still unmirrored, the header keeps the preview state and shows when that targeted mirror check last ran.

Chunk-view context now survives normal tab switching inside the document manager, so if you leave `Chunks` to inspect `Search`, `Documents`, or `Collections`, returning to `Chunks` preserves the active result origin, preview state, and highlighted chunk instead of dropping that context.

The chunk header also exposes runtime document identity directly for runtime-backed views: mirrored runtime docs show their document id and source label, while preview-only runtime results add an explicit `Mirror Pending` or `Mirror Ready` status.

## What the badges mean

- `Runtime`: the panel or result is using the live AgentOS retrieval runtime.
- `Demo`: the panel or result is using the workbench demo library.
- `Mixed`: the surface contains both runtime-backed and demo-backed pieces.

## Practical workflow

1. Start the backend with `OPENAI_API_KEY` configured.
2. Open the RAG workspace and confirm the header shows `Runtime Ready`.
3. Upload `.md` or `.txt` files, or ingest a URL.
4. Use the `Documents` tab to confirm the document appears with a `Runtime` badge.
5. Use `Assign On Ingest` if you want a new file or URL to land directly in a specific collection.
6. Create runtime collections when you want live-only grouping, or demo collections when you want to keep assets in the sample library.
7. Use the runtime panel collection selector when you want to query or ingest ad hoc text directly against one runtime collection.
8. Use the search scope dropdown to keep runtime and demo collection searches separate.

## Known limits

- PDF ingestion depends on `pdftotext` being installed on the backend host.
- URL ingestion currently supports text-like responses (`text/html`, `text/plain`, JSON/XML-style text responses). Binary content is rejected.
- Choosing a runtime collection forces a live runtime ingest path. Unsupported file types will fail instead of silently dropping into the demo library.
- Runtime collections currently organize workbench-mirrored runtime documents; they do not yet map to first-class collection filters inside the underlying AgentOS retrieval engine.
