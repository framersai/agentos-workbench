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

export interface TaskOutcomeWindowEntry {
  status: "success" | "partial" | "failed";
  score: number;
  timestamp: number;
}

export interface TaskOutcomeTelemetryWindowSummary {
  scopeKey: string;
  scopeMode: "global" | "organization" | "organization_persona" | "unknown";
  organizationId: string | null;
  personaId: string | null;
  sampleCount: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  successRate: number;
  averageScore: number;
  weightedSuccessRate: number;
  updatedAt: string;
  windowStartAt: string | null;
  windowEndAt: string | null;
  entries?: TaskOutcomeWindowEntry[];
}

export interface TaskOutcomeTelemetryResponse {
  windows: TaskOutcomeTelemetryWindowSummary[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    sortBy: "updated_at" | "weighted_success_rate" | "sample_count" | "scope_key";
    sortDir: "asc" | "desc";
  };
  totals: {
    windowCount: number;
    returnedWindowCount: number;
    sampleCount: number;
    successCount: number;
    partialCount: number;
    failedCount: number;
    successRate: number;
    averageScore: number;
    weightedSuccessRate: number;
  };
  filters: {
    scopeMode: string | null;
    organizationId: string | null;
    personaId: string | null;
    scopeContains?: string | null;
    limit: number;
    page?: number;
    sortBy?: string;
    sortDir?: string;
    includeEntries: boolean;
  };
}

export interface TaskOutcomeRuntimeConfigResponse {
  source: string;
  tenantRouting: {
    mode: "single_tenant" | "multi_tenant";
    defaultOrganizationId?: string;
    strictOrganizationIsolation: boolean;
  };
  taskOutcomeTelemetry: {
    enabled: boolean;
    rollingWindowSize: number;
    scope: "global" | "organization" | "organization_persona";
    emitAlerts: boolean;
    alertBelowWeightedSuccessRate: number;
    alertMinSamples: number;
    alertCooldownMs: number;
  };
  adaptiveExecution: {
    enabled: boolean;
    minSamples: number;
    minWeightedSuccessRate: number;
    forceAllToolsWhenDegraded: boolean;
    forceFailOpenWhenDegraded?: boolean;
  };
  turnPlanning: {
    enabled?: boolean;
    defaultToolFailureMode?: "fail_open" | "fail_closed";
    allowRequestOverrides?: boolean;
    discovery?: {
      enabled?: boolean;
      defaultToolSelectionMode?: "all" | "discovered";
      onlyAvailable?: boolean;
      includePromptContext?: boolean;
      maxRetries?: number;
      retryBackoffMs?: number;
    };
  };
}

export interface TaskOutcomeAlertHistoryItem {
  alertId: string;
  scopeKey: string;
  scopeMode: "global" | "organization" | "organization_persona" | "unknown";
  organizationId: string | null;
  personaId: string | null;
  severity: string;
  reason: string;
  threshold: number;
  value: number;
  sampleCount: number;
  alertTimestamp: string;
  streamId: string | null;
  sessionId: string | null;
  gmiInstanceId: string | null;
  personaStreamId: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskOutcomeAlertHistoryResponse {
  alerts: TaskOutcomeAlertHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    sortBy: "alert_timestamp" | "created_at" | "severity" | "scope_key";
    sortDir: "asc" | "desc";
  };
  totals: {
    alertCount: number;
    acknowledgedCount: number;
    unacknowledgedCount: number;
    criticalCount: number;
  };
  filters: {
    scopeMode: string | null;
    organizationId: string | null;
    personaId: string | null;
    scopeContains?: string | null;
    severity?: string | null;
    acknowledged?: boolean | null;
    limit: number;
    page?: number;
    sortBy?: string;
    sortDir?: string;
  };
}

export interface TaskOutcomeAlertRetentionConfig {
  enabled: boolean;
  retentionDays: number;
  maxRows: number;
  pruneIntervalMs: number;
}

export interface TaskOutcomeAlertRetentionSummary {
  config: TaskOutcomeAlertRetentionConfig;
  deletedByAge: number;
  deletedByOverflow: number;
  totalDeleted: number;
  remainingRows: number;
  prunedAt: string;
}

export interface TaskOutcomeAlertRetentionStatus {
  config: TaskOutcomeAlertRetentionConfig;
  lastPruneAt: string | null;
  pruneInFlight: boolean;
  lastSummary: TaskOutcomeAlertRetentionSummary | null;
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

  async getTaskOutcomeTelemetry(params?: {
    scopeMode?: "global" | "organization" | "organization_persona";
    organizationId?: string;
    personaId?: string;
    scopeContains?: string;
    limit?: number;
    page?: number;
    sortBy?: "updated_at" | "weighted_success_rate" | "sample_count" | "scope_key";
    sortDir?: "asc" | "desc";
    includeEntries?: boolean;
  }): Promise<TaskOutcomeTelemetryResponse> {
    const search = new URLSearchParams();
    if (params?.scopeMode) search.set("scopeMode", params.scopeMode);
    if (params?.organizationId) search.set("organizationId", params.organizationId);
    if (params?.personaId) search.set("personaId", params.personaId);
    if (params?.scopeContains) search.set("scopeContains", params.scopeContains);
    if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
      search.set("limit", String(Math.trunc(params.limit)));
    }
    if (typeof params?.page === "number" && Number.isFinite(params.page)) {
      search.set("page", String(Math.trunc(params.page)));
    }
    if (params?.sortBy) search.set("sortBy", params.sortBy);
    if (params?.sortDir) search.set("sortDir", params.sortDir);
    if (typeof params?.includeEntries === "boolean") {
      search.set("includeEntries", params.includeEntries ? "true" : "false");
    }
    const suffix = search.toString().length > 0 ? `?${search.toString()}` : "";
    const response = await fetch(`${this.baseUrl}/api/agentos/telemetry/task-outcomes${suffix}`);
    if (!response.ok) throw new Error("Failed to fetch task outcome telemetry");
    return (await response.json()) as TaskOutcomeTelemetryResponse;
  }

  async getTaskOutcomeTelemetryConfig(): Promise<TaskOutcomeRuntimeConfigResponse> {
    const response = await fetch(`${this.baseUrl}/api/agentos/telemetry/config`);
    if (!response.ok) throw new Error("Failed to fetch task outcome telemetry config");
    return (await response.json()) as TaskOutcomeRuntimeConfigResponse;
  }

  async getTaskOutcomeAlertHistory(params?: {
    scopeMode?: "global" | "organization" | "organization_persona";
    organizationId?: string;
    personaId?: string;
    scopeContains?: string;
    severity?: string;
    acknowledged?: boolean;
    limit?: number;
    page?: number;
    sortBy?: "alert_timestamp" | "created_at" | "severity" | "scope_key";
    sortDir?: "asc" | "desc";
  }): Promise<TaskOutcomeAlertHistoryResponse> {
    const search = new URLSearchParams();
    if (params?.scopeMode) search.set("scopeMode", params.scopeMode);
    if (params?.organizationId) search.set("organizationId", params.organizationId);
    if (params?.personaId) search.set("personaId", params.personaId);
    if (params?.scopeContains) search.set("scopeContains", params.scopeContains);
    if (params?.severity) search.set("severity", params.severity);
    if (typeof params?.acknowledged === "boolean") {
      search.set("acknowledged", params.acknowledged ? "true" : "false");
    }
    if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
      search.set("limit", String(Math.trunc(params.limit)));
    }
    if (typeof params?.page === "number" && Number.isFinite(params.page)) {
      search.set("page", String(Math.trunc(params.page)));
    }
    if (params?.sortBy) search.set("sortBy", params.sortBy);
    if (params?.sortDir) search.set("sortDir", params.sortDir);
    const suffix = search.toString().length > 0 ? `?${search.toString()}` : "";
    const response = await fetch(`${this.baseUrl}/api/agentos/telemetry/alerts${suffix}`);
    if (!response.ok) throw new Error("Failed to fetch task outcome alert history");
    return (await response.json()) as TaskOutcomeAlertHistoryResponse;
  }

  async setTaskOutcomeAlertAcknowledged(
    alertId: string,
    acknowledged: boolean
  ): Promise<{ alert: TaskOutcomeAlertHistoryItem }> {
    const response = await fetch(
      `${this.baseUrl}/api/agentos/telemetry/alerts/${encodeURIComponent(alertId)}/acknowledge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acknowledged,
          userId: "agentos-workbench-user",
        }),
      }
    );
    if (!response.ok) throw new Error("Failed to update task outcome alert acknowledgement");
    return (await response.json()) as { alert: TaskOutcomeAlertHistoryItem };
  }

  async getTaskOutcomeAlertRetentionStatus(): Promise<TaskOutcomeAlertRetentionStatus> {
    const response = await fetch(`${this.baseUrl}/api/agentos/telemetry/alerts/retention`);
    if (!response.ok) throw new Error("Failed to fetch task outcome alert retention status");
    return (await response.json()) as TaskOutcomeAlertRetentionStatus;
  }

  async pruneTaskOutcomeAlertHistory(options?: {
    enabled?: boolean;
    retentionDays?: number;
    maxRows?: number;
    pruneIntervalMs?: number;
  }): Promise<{ summary: TaskOutcomeAlertRetentionSummary; status: TaskOutcomeAlertRetentionStatus }> {
    const response = await fetch(`${this.baseUrl}/api/agentos/telemetry/alerts/prune`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options ?? {}),
    });
    if (!response.ok) throw new Error("Failed to prune task outcome alert history");
    return (await response.json()) as {
      summary: TaskOutcomeAlertRetentionSummary;
      status: TaskOutcomeAlertRetentionStatus;
    };
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
export const getTaskOutcomeTelemetry = agentosClient.getTaskOutcomeTelemetry.bind(agentosClient);
export const getTaskOutcomeTelemetryConfig =
  agentosClient.getTaskOutcomeTelemetryConfig.bind(agentosClient);
export const getTaskOutcomeAlertHistory =
  agentosClient.getTaskOutcomeAlertHistory.bind(agentosClient);
export const setTaskOutcomeAlertAcknowledged =
  agentosClient.setTaskOutcomeAlertAcknowledged.bind(agentosClient);
export const getTaskOutcomeAlertRetentionStatus =
  agentosClient.getTaskOutcomeAlertRetentionStatus.bind(agentosClient);
export const pruneTaskOutcomeAlertHistory =
  agentosClient.pruneTaskOutcomeAlertHistory.bind(agentosClient);

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
  workflowDefinitionId?: string;
  userId: string;
  conversationId?: string;
  goal?: string;
  status: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  totalCostUsd?: number;
  totalTokens?: number;
  outputFormat?: string;
  consolidatedOutput?: string;
  emergentMetadata?: string;
  error?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

/** Agency seat record from the API */
export interface AgencySeatRecord {
  id: string;
  agencyId: string;
  roleId: string;
  personaId: string;
  gmiInstanceId?: string;
  status: string;
  startedAt?: number;
  completedAt?: number;
  output?: string;
  error?: string;
  usageTokens?: number;
  usageCostUsd?: number;
  retryCount: number;
  metadata?: Record<string, unknown> | string;
}

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNum(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function normalizeAgencyExecutionRecord(raw: unknown): AgencyExecutionRecord {
  const obj = asObj(raw);
  const startedAt =
    asNum(obj.startedAt) ??
    asNum(obj.started_at) ??
    Date.now();
  const createdAtRaw = asString(obj.createdAt) || asString(obj.created_at);
  const createdAt =
    createdAtRaw ||
    new Date(startedAt).toISOString();
  const updatedAtRaw = asString(obj.updatedAt) || asString(obj.updated_at);

  return {
    agencyId: asString(obj.agencyId) || asString(obj.agency_id),
    workflowDefinitionId: asString(obj.workflowDefinitionId) || asString(obj.workflow_definition_id) || undefined,
    userId: asString(obj.userId) || asString(obj.user_id),
    conversationId: asString(obj.conversationId) || asString(obj.conversation_id) || undefined,
    goal: asString(obj.goal) || undefined,
    status: asString(obj.status, "pending"),
    startedAt,
    completedAt: asNum(obj.completedAt) ?? asNum(obj.completed_at),
    durationMs: asNum(obj.durationMs) ?? asNum(obj.duration_ms),
    totalCostUsd: asNum(obj.totalCostUsd) ?? asNum(obj.total_cost_usd),
    totalTokens: asNum(obj.totalTokens) ?? asNum(obj.total_tokens),
    outputFormat: asString(obj.outputFormat) || asString(obj.output_format) || undefined,
    consolidatedOutput: asString(obj.consolidatedOutput) || asString(obj.consolidated_output) || undefined,
    emergentMetadata: asString(obj.emergentMetadata) || asString(obj.emergent_metadata) || undefined,
    error: asString(obj.error) || undefined,
    createdAt,
    updatedAt: updatedAtRaw || undefined,
    metadata: asObj(obj.metadata),
  };
}

function normalizeAgencySeatRecord(raw: unknown): AgencySeatRecord {
  const obj = asObj(raw);
  let metadata: Record<string, unknown> | string | undefined;
  if (typeof obj.metadata === "string") {
    metadata = obj.metadata;
    try {
      const parsed = JSON.parse(obj.metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      // Keep raw string metadata when JSON parsing fails.
    }
  } else if (obj.metadata && typeof obj.metadata === "object" && !Array.isArray(obj.metadata)) {
    metadata = obj.metadata as Record<string, unknown>;
  }

  return {
    id: asString(obj.id),
    agencyId: asString(obj.agencyId) || asString(obj.agency_id),
    roleId: asString(obj.roleId) || asString(obj.role_id),
    personaId: asString(obj.personaId) || asString(obj.persona_id),
    gmiInstanceId: asString(obj.gmiInstanceId) || asString(obj.gmi_instance_id) || undefined,
    status: asString(obj.status, "pending"),
    startedAt: asNum(obj.startedAt) ?? asNum(obj.started_at),
    completedAt: asNum(obj.completedAt) ?? asNum(obj.completed_at),
    output: asString(obj.output) || undefined,
    error: asString(obj.error) || undefined,
    usageTokens: asNum(obj.usageTokens) ?? asNum(obj.usage_tokens),
    usageCostUsd: asNum(obj.usageCostUsd) ?? asNum(obj.usage_cost_usd),
    retryCount: asNum(obj.retryCount) ?? asNum(obj.retry_count) ?? 0,
    metadata,
  };
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
  return Array.isArray(data?.executions)
    ? data.executions.map((item: unknown) => normalizeAgencyExecutionRecord(item))
    : [];
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
  const data = await response.json();
  const execution = normalizeAgencyExecutionRecord(data?.execution);
  const seats = Array.isArray(data?.seats)
    ? data.seats.map((seat: unknown) => normalizeAgencySeatRecord(seat))
    : [];
  return { execution, seats };
}
