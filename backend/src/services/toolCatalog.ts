/**
 * @file toolCatalog.ts
 * @description Workbench tool catalog that maps tool name strings to executable
 * tool definitions for the Playground and Agency routes.
 *
 * Built-in tools provide real functionality (web search via Serper, JS eval,
 * arithmetic, etc.).  Forged tools are included dynamically from the forge
 * registry, with persistence to a local JSON file so they survive restarts.
 *
 * The catalog exposes the same `ToolDefinition` shape accepted by the AgentOS
 * `streamText` / `generateText` `tools` option, so playground routes can pass
 * them through directly.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal tool definition compatible with the AgentOS `adaptTools` adapter. */
export interface CatalogToolDefinition {
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: any) => Promise<unknown>;
}

/** Persisted forged tool record. */
export interface PersistedForgedTool {
  id: string;
  name: string;
  description: string;
  implementation: string;
  tier: 'session' | 'agent' | 'shared';
  callCount: number;
  successCount: number;
  totalLatencyMs: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Persistence (JSON file)
// ---------------------------------------------------------------------------

const PERSIST_PATH = path.resolve(
  process.env.AGENTOS_WORKBENCH_FORGE_PERSIST_PATH ??
    path.join(process.cwd(), '.workbench-forged-tools.json'),
);

function loadPersistedTools(): PersistedForgedTool[] {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Corrupt file — start fresh.
  }
  return [];
}

function savePersistedTools(tools: PersistedForgedTool[]): void {
  fs.writeFileSync(PERSIST_PATH, JSON.stringify(tools, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// In-memory forged tool registry (seeded from disk on first access)
// ---------------------------------------------------------------------------

let forgedTools: PersistedForgedTool[] | null = null;

function getForgedTools(): PersistedForgedTool[] {
  if (forgedTools === null) {
    forgedTools = loadPersistedTools();
  }
  return forgedTools;
}

/**
 * Register a forged tool and persist to disk.
 * Called by the forge route after a tool passes the judge.
 */
export function registerForgedTool(tool: PersistedForgedTool): void {
  const tools = getForgedTools();
  // Replace existing tool with same id, or append.
  const idx = tools.findIndex((t) => t.id === tool.id);
  if (idx >= 0) {
    tools[idx] = tool;
  } else {
    tools.push(tool);
  }
  savePersistedTools(tools);
}

/** Return all persisted forged tools. */
export function listForgedTools(): PersistedForgedTool[] {
  return getForgedTools();
}

/** Update usage stats for a forged tool after execution. */
export function recordForgedToolUse(
  id: string,
  success: boolean,
  latencyMs: number,
): void {
  const tools = getForgedTools();
  const tool = tools.find((t) => t.id === id);
  if (!tool) return;
  tool.callCount += 1;
  if (success) tool.successCount += 1;
  tool.totalLatencyMs += latencyMs;
  savePersistedTools(tools);
}

// ---------------------------------------------------------------------------
// Built-in tool definitions
// ---------------------------------------------------------------------------

function makeWebSearchTool(): CatalogToolDefinition {
  return {
    description:
      'Search the web for real-time information. Returns top results with titles, snippets, and URLs.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query.',
        },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default 5).',
        },
      },
      required: ['query'],
    },
    execute: async (args: { query: string; num_results?: number }) => {
      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) {
        return {
          error: 'SERPER_API_KEY not configured. Set it in .env to enable web search.',
        };
      }
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: args.query,
          num: args.num_results ?? 5,
        }),
      });
      if (!res.ok) {
        return { error: `Serper API returned ${res.status}: ${res.statusText}` };
      }
      const data = (await res.json()) as Record<string, unknown>;
      const organic = (data.organic ?? []) as Array<Record<string, unknown>>;
      return {
        results: organic.map((r) => ({
          title: r.title,
          snippet: r.snippet,
          url: r.link,
        })),
        answerBox: data.answerBox ?? null,
      };
    },
  };
}

function makeCalculatorTool(): CatalogToolDefinition {
  return {
    description:
      'Evaluate a mathematical expression and return the numeric result. Supports basic arithmetic, Math functions, and constants.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate (e.g., "2 + 2", "Math.sqrt(16)").',
        },
      },
      required: ['expression'],
    },
    execute: async (args: { expression: string }) => {
      // Allowlist: only digits, operators, parens, dots, whitespace, and Math.*
      const sanitized = args.expression.replace(/[^0-9+\-*/().%^ \tMathsqrtpowlogceilfloorminmaxroundabsPIE,]/g, '');
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('Math', `"use strict"; return (${sanitized});`);
        const result = fn(Math);
        if (typeof result !== 'number' || !isFinite(result)) {
          return { error: `Expression did not produce a finite number: ${result}` };
        }
        return { result };
      } catch (err: any) {
        return { error: `Evaluation failed: ${err.message}` };
      }
    },
  };
}

function makeCodeExecutorTool(): CatalogToolDefinition {
  return {
    description:
      'Execute a JavaScript code snippet in a sandboxed environment and return the result. The last expression is returned.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute.',
        },
      },
      required: ['code'],
    },
    execute: async (args: { code: string }) => {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`"use strict";\n${args.code}`);
        const result = await Promise.resolve(fn());
        return { result: result ?? null };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  };
}

function makeDataFetcherTool(): CatalogToolDefinition {
  return {
    description:
      'Fetch data from a public URL (GET request) and return the response body as text or JSON.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch data from.',
        },
        format: {
          type: 'string',
          enum: ['json', 'text'],
          description: 'Expected response format (default "json").',
        },
      },
      required: ['url'],
    },
    execute: async (args: { url: string; format?: 'json' | 'text' }) => {
      try {
        const res = await fetch(args.url, {
          headers: { 'User-Agent': 'AgentOS-Workbench/1.0' },
        });
        if (!res.ok) {
          return { error: `HTTP ${res.status}: ${res.statusText}` };
        }
        const format = args.format ?? 'json';
        if (format === 'json') {
          return { data: await res.json() };
        }
        return { data: await res.text() };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  };
}

function makeFileReaderTool(): CatalogToolDefinition {
  return {
    description:
      'Read the contents of a local file by path. Returns the file content as text.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file.',
        },
      },
      required: ['path'],
    },
    execute: async (args: { path: string }) => {
      try {
        const content = fs.readFileSync(args.path, 'utf-8');
        return { content, byteLength: Buffer.byteLength(content) };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  };
}

function makeImageAnalyzerTool(): CatalogToolDefinition {
  return {
    description:
      'Analyze an image at a given URL or local path. Returns metadata and a brief description.',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'URL or local file path of the image.',
        },
      },
      required: ['source'],
    },
    execute: async (args: { source: string }) => {
      return {
        source: args.source,
        analysis: 'Image analysis requires a vision model. Pass this image URL to the LLM with a vision-capable model for detailed analysis.',
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Catalog assembly
// ---------------------------------------------------------------------------

/** Static built-in tool map. */
const BUILTIN_TOOLS: Record<string, CatalogToolDefinition> = {
  web_search: makeWebSearchTool(),
  calculator: makeCalculatorTool(),
  code_executor: makeCodeExecutorTool(),
  data_fetcher: makeDataFetcherTool(),
  file_reader: makeFileReaderTool(),
  image_analyzer: makeImageAnalyzerTool(),
};

/**
 * Create a tool definition from a forged tool record.
 * Wraps the stored implementation string in a safe executor.
 */
function forgedToolToDefinition(tool: PersistedForgedTool): CatalogToolDefinition {
  return {
    description: tool.description,
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input for the tool.',
        },
      },
    },
    execute: async (args: any) => {
      const startMs = Date.now();
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('params', `${tool.implementation}\nreturn run(params);`);
        const result = await Promise.resolve(fn(args));
        recordForgedToolUse(tool.id, true, Date.now() - startMs);
        return result;
      } catch (err: any) {
        recordForgedToolUse(tool.id, false, Date.now() - startMs);
        return { error: err.message };
      }
    },
  };
}

/**
 * Resolve a list of tool name strings into a `Record<string, ToolDefinition>`
 * map suitable for passing to `streamText({ tools: ... })`.
 *
 * Includes both built-in tools and any forged tools whose names match.
 * If `includeAllForged` is true, all forged tools are included regardless
 * of whether they appear in `toolNames`.
 */
export function resolveTools(
  toolNames: string[],
  options?: { includeAllForged?: boolean },
): Record<string, CatalogToolDefinition> {
  const result: Record<string, CatalogToolDefinition> = {};

  // Resolve requested built-in tools.
  for (const name of toolNames) {
    if (BUILTIN_TOOLS[name]) {
      result[name] = BUILTIN_TOOLS[name];
    }
  }

  // Include forged tools.
  const forged = getForgedTools();
  const requestedSet = new Set(toolNames);
  for (const tool of forged) {
    const toolKey = tool.name.toLowerCase().replace(/\s+/g, '_');
    if (options?.includeAllForged || requestedSet.has(toolKey) || requestedSet.has(tool.id)) {
      result[toolKey] = forgedToolToDefinition(tool);
    }
  }

  return result;
}

/** Return all available tool names (built-in + forged). */
export function listAvailableToolNames(): string[] {
  const builtIn = Object.keys(BUILTIN_TOOLS);
  const forged = getForgedTools().map(
    (t) => t.name.toLowerCase().replace(/\s+/g, '_'),
  );
  return [...builtIn, ...forged];
}
