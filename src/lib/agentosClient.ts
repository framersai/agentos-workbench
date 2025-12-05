import type { AgentOSResponse } from "@/types/agentos";
import type { PersonaDefinition } from "@/state/sessionStore";
import type { WorkflowDefinition } from "@/types/workflow";

interface Extension {
  id: string;
  name: string;
  package: string;
  version: string;
  description: string;
  category: string;
  verified?: boolean;
  installed?: boolean;
  tools?: string[];
}

interface Tool {
  id: string;
  name: string;
  description: string;
  extension: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  hasSideEffects?: boolean;
}

export interface AgentOSModelInfo {
  id: string;
  displayName?: string;
  provider?: string;
  pricing?: {
    inputCostPer1K?: number;
    outputCostPer1K?: number;
  };
}

type WorkflowRequestPayload = {
  definitionId: string;
  workflowId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
};

type AgencyParticipantPayload = {
  roleId: string;
  personaId?: string;
  instruction?: string;
  priority?: number;
};

type AgencyRequestPayload = {
  agencyId?: string;
  workflowId?: string;
  goal?: string;
  participants?: AgencyParticipantPayload[];
  metadata?: Record<string, unknown>;
};

type StreamOptions = {
  model?: string;
  workflowRequest?: WorkflowRequestPayload;
  agencyRequest?: AgencyRequestPayload;
};

// Filters for listing personas from backend
export type ListPersonaFilters = {
  capability?: string | string[];
  tier?: string | string[];
  search?: string;
};

/**
 * Thin client wrapper for calling the AgentOS-enabled backend from the workbench UI.
 * - Resolves base URL from `VITE_API_URL` or current origin (dev defaults to `http://localhost:3001` from Vite).
 * - Provides helpers for streaming chat, listing personas/workflows/models, and extension/tool operations.
 * @public
 */
class AgentOSClient {
  private baseUrl: string;

  constructor() {
    const devDefault = (typeof window !== 'undefined' && window.location && window.location.port === '5175')
      ? 'http://localhost:3001'
      : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
    this.baseUrl = import.meta.env.VITE_API_URL || devDefault;
  }

  // ... existing methods ...

	/**
	 * Send a single-turn chat message (non-streaming) to the AgentOS backend.
	 * @param personaId Persona or mode identifier.
	 * @param message User input string.
	 * @param sessionId Optional conversation/session id (auto-generated if omitted).
	 * @param includeTools Whether to enable tool execution (backend-dependent).
	 * @param includeGuardrails Whether to enable guardrails (backend-dependent).
	 * @returns Raw fetch Response for callers that need headers/status.
	 */
  async sendMessage(
    personaId: string,
    message: string,
    sessionId?: string,
    includeTools = true,
    includeGuardrails = false
  ) {
    const response = await fetch(`${this.baseUrl}/api/agentos/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'agentos-workbench-user',
        personaId,
        input: message,
        conversationId: sessionId || `session_${Date.now()}`,
        includeTools,
        includeGuardrails
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response;
  }

	/**
	 * Open a Server-Sent Events (SSE) stream for a single user message.
	 * Parses SSE lines into {@link AgentOSResponse} chunks and forwards them to handlers.
	 * @param personaId Selected persona/mode id used by the backend stream router.
	 * @param message User input string to send.
	 * @param sessionId Optional conversation id to correlate turns.
	 * @param onChunk Handler for parsed AgentOS chunks.
	 * @param onComplete Called when the stream ends.
	 * @param onError Called on network or parsing errors.
	 * @param opts Optional model, workflowRequest, and agencyRequest.
	 */
  async streamMessage(
    personaId: string,
    message: string,
    sessionId?: string,
    onChunk?: (chunk: AgentOSResponse) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void,
    opts?: StreamOptions
  ) {
    try {
      // Use GET SSE via stream router by default
      const params = new URLSearchParams({
        userId: 'agentos-workbench-user',
        mode: personaId, // stream router uses `mode` as selectedPersonaId
        conversationId: sessionId || `session_${Date.now()}`,
        messages: JSON.stringify([{ role: 'user', content: message }]),
      });
      if (opts?.model) params.set('model', opts.model);
      if (opts?.workflowRequest) params.set('workflowRequest', JSON.stringify(opts.workflowRequest));
      if (opts?.agencyRequest) params.set('agencyRequest', JSON.stringify(opts.agencyRequest));
      const url = `${this.baseUrl}/api/agentos/stream?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' }
      });

      if (!response.ok) {
        throw new Error('Failed to start stream');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let doneReading = false;
      while (!doneReading) {
        const { done, value } = await reader.read();
        if (done) {
          doneReading = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data && data !== '{}') {
              try {
                const chunk = JSON.parse(data);
                onChunk?.(chunk);
              } catch (e) {
                console.error('Failed to parse SSE chunk:', e);
              }
            }
          } else if (line.startsWith('event: done')) {
            onComplete?.();
            return;
          } else if (line.startsWith('event: error')) {
            // Find the next data line for error details
            const errorLine = lines.find(l => l.startsWith('data: '));
            if (errorLine) {
              try {
                const errorData = JSON.parse(errorLine.slice(6));
                onError?.(new Error(errorData.message || 'Stream error'));
              } catch {
                onError?.(new Error('Stream error'));
              }
            }
            return;
          }
        }
      }
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }

	/**
	 * Fetch personas available to the workbench, optionally filtered server-side.
	 * @returns Array of {@link PersonaDefinition}.
	 */
  async listPersonas(params?: { userId?: string; filters?: ListPersonaFilters; signal?: AbortSignal }): Promise<PersonaDefinition[]> {
    const search = new URLSearchParams();
    const userId = params?.userId ?? 'agentos-workbench-user';
    search.set('userId', userId);
    const filters = params?.filters;
    if (filters?.capability) {
      const caps = Array.isArray(filters.capability) ? filters.capability : [filters.capability];
      for (const cap of caps) search.append('capability', cap);
    }
    if (filters?.tier) {
      const tiers = Array.isArray(filters.tier) ? filters.tier : [filters.tier];
      for (const t of tiers) search.append('tier', t);
    }
    if (filters?.search) {
      search.set('search', filters.search);
    }
    const response = await fetch(`${this.baseUrl}/api/agentos/personas?${search.toString()}`, { signal: params?.signal });
    if (!response.ok) {
      throw new Error('Failed to fetch personas');
    }
    const data = await response.json();
    // Handle both array response and object with personas field
    return (Array.isArray(data) ? data : (data.personas || [])) as PersonaDefinition[];
  }

	/**
	 * Fetch workflow definitions from the backend.
	 * @returns Array of {@link WorkflowDefinition}.
	 */
  async listWorkflows(): Promise<WorkflowDefinition[]> {
    const response = await fetch(`${this.baseUrl}/api/agentos/workflows/definitions`);
    if (!response.ok) {
      throw new Error('Failed to fetch workflows');
    }
    const data = await response.json();
    // Handle both array response and object with definitions field
    return (Array.isArray(data) ? data : (data.definitions || [])) as WorkflowDefinition[];
  }

  // Alias for backwards compatibility
  async listWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
    return this.listWorkflows();
  }

	/**
	 * Execute an agency by id with arbitrary input (non-streaming).
	 * @param agencyId Target agency id.
	 * @param input Arbitrary JSON input payload.
	 */
  async executeAgency(
    agencyId: string,
    input: unknown
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/api/agentos/agency/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agencyId,
        input,
        userId: 'agentos-workbench-user'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to execute agency');
    }

    return response;
  }

  // New Extension Methods

	/** List extensions from backend registry. */
  async getExtensions(): Promise<Extension[]> {
    const response = await fetch(`${this.baseUrl}/api/agentos/extensions`);
    if (!response.ok) {
      throw new Error('Failed to fetch extensions');
    }
    const data = await response.json();
    // Extensions endpoint returns array directly
    return Array.isArray(data) ? data : [];
  }

	/** List tools derived from installed/available extensions. */
  async getAvailableTools(): Promise<Tool[]> {
    const response = await fetch(`${this.baseUrl}/api/agentos/extensions/tools`);
    if (!response.ok) {
      throw new Error('Failed to fetch available tools');
    }
    const data = await response.json();
    // Tools endpoint returns array directly
    return Array.isArray(data) ? data : [];
  }

	/**
	 * Request extension installation by package name.
	 * Note: server currently invalidates cache only (placeholder).
	 */
  async installExtension(packageName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/agentos/extensions/install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ package: packageName }),
    });

    if (!response.ok) {
      throw new Error('Failed to install extension');
    }
  }

	/**
	 * Execute a tool by id with arbitrary input.
	 * Returns tool-specific output object.
	 */
  async executeTool(toolId: string, input: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/agentos/tools/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolId,
        input,
        userId: 'agentos-workbench-user'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to execute tool');
    }

    return response.json();
  }

	/** Start an example agency workflow; responses are non-streaming. */
  async startAgencyWorkflow(input: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/agentos/agency/workflow/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowId: 'research-and-report',
        input,
        userId: 'agentos-workbench-user'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to start agency workflow');
    }

    return response.json();
  }

  // Diagnostics
	/** Get backend LLM provider status snapshot. */
  async getLlmStatus(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/api/system/llm-status`);
    if (!response.ok) throw new Error('Failed to fetch LLM status');
    return response.json();
  }

	/** List available models with pricing metadata (if configured). */
  async getAvailableModels(): Promise<AgentOSModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/agentos/models`);
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    return models as AgentOSModelInfo[];
  }

  // Open a streaming connection to AgentOS
	/**
	 * Open an AgentOS stream and return a cleanup function.
	 * Wraps {@link streamMessage} and allows cancellation in the future.
	 */
  openAgentOSStream(
    params: {
      sessionId: string;
      personaId: string;
      messages: Array<{ role: string; content: string }>;
      workflowRequest?: WorkflowRequestPayload;
      agencyRequest?: AgencyRequestPayload;
      model?: string;
    },
    handlers: {
      onChunk?: (chunk: AgentOSResponse) => void;
      onDone?: () => void;
      onError?: (error: Error) => void;
    }
  ): () => void {
    // Create an AbortController for cancellation (future use)
    const abortController = new AbortController();
    
    // Start the stream via GET SSE
    this.streamMessage(
      params.personaId,
      params.messages[params.messages.length - 1].content,
      params.sessionId,
      handlers.onChunk,
      handlers.onDone,
      handlers.onError,
      { model: params.model, workflowRequest: params.workflowRequest, agencyRequest: params.agencyRequest }
    );
    
    // Return cleanup function
    return () => {
      abortController.abort();
    };
  }

  // WebSocket methods are not currently used - app uses SSE instead
  // If WebSocket support is needed in the future, add socket.io-client back
  // and use dynamic imports to avoid Node.js module issues

	/** Fetch curated/community guardrails from backend registry. */
	async getGuardrails(): Promise<GuardrailDescriptor[]> {
		const response = await fetch(`${this.baseUrl}/api/agentos/guardrails`);
		if (!response.ok) throw new Error('Failed to fetch guardrails');
		const data = await response.json();
		return Array.isArray(data) ? (data as GuardrailDescriptor[]) : [];
	}
}

export const agentosClient = new AgentOSClient();

// Export individual methods for direct import (bound to instance)
export const sendMessage = agentosClient.sendMessage.bind(agentosClient);
export const streamMessage = agentosClient.streamMessage.bind(agentosClient);
export const openAgentOSStream = agentosClient.openAgentOSStream.bind(agentosClient);
export const listPersonas = agentosClient.listPersonas.bind(agentosClient);
export const listWorkflows = agentosClient.listWorkflows.bind(agentosClient);
export const listWorkflowDefinitions = agentosClient.listWorkflowDefinitions.bind(agentosClient);
export const executeAgency = agentosClient.executeAgency.bind(agentosClient);

// Export agency-specific utilities
export { streamAgencyWorkflow, type AgentRoleConfig, type AgencyStreamInput } from './agencyClient';
export const getExtensions = agentosClient.getExtensions.bind(agentosClient);
export const getAvailableTools = agentosClient.getAvailableTools.bind(agentosClient);
export const installExtension = agentosClient.installExtension.bind(agentosClient);
export const executeTool = agentosClient.executeTool.bind(agentosClient);
export const startAgencyWorkflow = agentosClient.startAgencyWorkflow.bind(agentosClient);
export const getLlmStatus = agentosClient.getLlmStatus.bind(agentosClient);
export const getAvailableModels = agentosClient.getAvailableModels.bind(agentosClient);

// Guardrails
// Guardrails
export interface GuardrailDescriptor {
	id: string;
	package: string;
	version: string;
	displayName: string;
	description?: string;
	category?: 'safety' | 'privacy' | 'budget' | 'compliance' | 'quality' | 'custom';
	verified?: boolean;
	capabilities?: string[];
	repository?: string;
}

/** Agency execution record from the API */
export interface AgencyExecutionRecord {
  agencyId: string;
  workflowId: string;
  userId: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

/** Agency seat record from the API */
export interface AgencySeatRecord {
  seatId: string;
  agencyId: string;
  roleId: string;
  gmiId?: string;
  status: string;
  metadata?: Record<string, unknown>;
}

/**
 * List agency executions for a user
 */
export async function listAgencyExecutions(userId: string, limit?: number): Promise<AgencyExecutionRecord[]> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3333';
  const params = new URLSearchParams({ userId });
  if (limit) {
    params.set('limit', String(limit));
  }
  const response = await fetch(`${baseUrl}/api/agentos/agency/executions?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agency executions: ${response.statusText}`);
  }
  const data = await response.json();
  return data.executions ?? [];
}

/**
 * Get a specific agency execution with all seats
 */
export async function getAgencyExecution(agencyId: string): Promise<{ execution: AgencyExecutionRecord; seats: AgencySeatRecord[] } | null> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3333';
  const response = await fetch(`${baseUrl}/api/agentos/agency/executions/${agencyId}`);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch agency execution: ${response.statusText}`);
  }
  return await response.json();
}

