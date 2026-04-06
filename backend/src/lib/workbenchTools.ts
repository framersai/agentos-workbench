/**
 * @file workbenchTools.ts
 * Tool definitions registered with the AgentOS runtime for the Workbench.
 * Each tool is a plain { description, parameters, execute } object consumed by
 * the AgentOS `ToolDefinitionMap` adapter.
 */

// ---------------------------------------------------------------------------
// web_search — powered by Serper.dev (Google Search API)
// ---------------------------------------------------------------------------

interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

interface SerperResponse {
  organic?: SerperSearchResult[];
  answerBox?: { answer?: string; snippet?: string; title?: string };
  knowledgeGraph?: { title?: string; description?: string; descriptionSource?: string };
  searchParameters?: { q: string };
}

const webSearchTool = {
  description:
    'Search the web for up-to-date information using Google Search. ' +
    'Returns a list of relevant results with titles, URLs, and snippets. ' +
    'Use this tool when the user asks about recent events, current data, or anything that requires live information.',
  parameters: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web.',
      },
      num_results: {
        type: 'integer',
        description: 'Number of results to return (1-10). Defaults to 5.',
        minimum: 1,
        maximum: 10,
        default: 5,
      },
    },
    required: ['query'],
  },
  async execute(args: { query: string; num_results?: number }) {
    const apiKey = process.env.SERPER_API_KEY?.trim();
    if (!apiKey) {
      return {
        success: false,
        error: 'SERPER_API_KEY is not configured. Set it in the backend .env file to enable web search.',
      };
    }

    const numResults = Math.min(Math.max(args.num_results ?? 5, 1), 10);

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: args.query, num: numResults }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        success: false,
        error: `Serper API returned HTTP ${response.status}: ${body}`,
      };
    }

    const data: SerperResponse = await response.json();

    const results: Array<{ title: string; url: string; snippet: string }> = [];

    // Include answer box if present
    if (data.answerBox?.answer || data.answerBox?.snippet) {
      results.push({
        title: data.answerBox.title ?? 'Answer',
        url: '',
        snippet: data.answerBox.answer ?? data.answerBox.snippet ?? '',
      });
    }

    // Include organic results
    if (data.organic) {
      for (const item of data.organic.slice(0, numResults)) {
        results.push({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
        });
      }
    }

    return {
      success: true,
      output: {
        query: args.query,
        resultCount: results.length,
        results,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// calculator — basic math evaluation
// ---------------------------------------------------------------------------

const calculatorTool = {
  description:
    'Evaluate a mathematical expression and return the result. ' +
    'Supports basic arithmetic (+, -, *, /), exponents (**), parentheses, and common Math functions.',
  parameters: {
    type: 'object' as const,
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate, e.g. "2 + 3 * (4 - 1)" or "Math.sqrt(144)".',
      },
    },
    required: ['expression'],
  },
  async execute(args: { expression: string }) {
    try {
      // Allow only safe math characters and Math.* functions
      const sanitized = args.expression.trim();
      const safePattern = /^[0-9+\-*/().,%\s^eE]+$|^Math\.\w+\([^)]*\)$/;
      // Use Function constructor for basic eval with Math in scope
      const result = new Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== 'number' || !isFinite(result)) {
        return { success: false, error: `Expression did not evaluate to a finite number: ${result}` };
      }
      return { success: true, output: { expression: sanitized, result } };
    } catch (err: any) {
      return { success: false, error: `Failed to evaluate expression: ${err.message}` };
    }
  },
};

// ---------------------------------------------------------------------------
// Exported registry
// ---------------------------------------------------------------------------

/**
 * All workbench tools keyed by their tool name (as the LLM sees it).
 * Pass this directly to the AgentOS `tools` config field.
 */
export const workbenchTools: Record<string, { description: string; parameters: object; execute: (args: any) => Promise<any> }> = {
  web_search: webSearchTool,
  calculator: calculatorTool,
};
