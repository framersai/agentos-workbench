import { agentOSConfig, buildAgentOSUrl } from "@/lib/env";
import type { AgentOSPersonaSummary, AgentOSResponse } from "@/types/agentos";
import type { WorkflowDefinition } from "@/types/workflow";

interface ConversationMessage {
  role: "user" | "assistant" | "system" | string;
  content: string;
}

export interface AgentOSStreamParams {
  sessionId: string;
  userId?: string;
  personaId?: string;
  messages: ConversationMessage[];
  workflowRequest?: Record<string, unknown>;
  agencyRequest?: Record<string, unknown>;
}

interface AgentOSStreamHandlers {
  onChunk: (chunk: AgentOSResponse) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

const safeStringify = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

export const openAgentOSStream = (params: AgentOSStreamParams, handlers: AgentOSStreamHandlers): (() => void) => {
  const search = new URLSearchParams();
  search.set("userId", params.userId ?? agentOSConfig.defaultUserId);
  search.set("conversationId", params.sessionId);
  search.set("mode", params.personaId ?? "voice_assistant_persona");
  const messagesJson = safeStringify(params.messages);
  if (messagesJson) {
    search.set("messages", messagesJson);
  }
  const workflowJson = params.workflowRequest ? safeStringify(params.workflowRequest) : undefined;
  if (workflowJson) {
    search.set("workflowRequest", workflowJson);
  }
  const agencyJson = params.agencyRequest ? safeStringify(params.agencyRequest) : undefined;
  if (agencyJson) {
    search.set("agencyRequest", agencyJson);
  }

  const url = `${buildAgentOSUrl(agentOSConfig.streamPath)}?${search.toString()}`;
  const eventSource = new EventSource(url, { withCredentials: agentOSConfig.withCredentials });

  const cleanup = () => {
    eventSource.close();
  };

  eventSource.onmessage = (event) => {
    if (!event.data) {
      return;
    }
    try {
      const chunk = JSON.parse(event.data) as AgentOSResponse;
      handlers.onChunk(chunk);
    } catch (error) {
      handlers.onError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  eventSource.addEventListener("done", () => {
    cleanup();
    handlers.onDone();
  });

  eventSource.onerror = () => {
    cleanup();
    handlers.onError(new Error("AgentOS stream error"));
  };

  return cleanup;
};

export interface ListPersonaFilters {
  capability?: string | string[];
  tier?: string | string[];
  search?: string;
}

export interface ListPersonasParams {
  userId?: string;
  filters?: ListPersonaFilters;
  signal?: AbortSignal;
}

export async function listPersonas(params: ListPersonasParams = {}): Promise<AgentOSPersonaSummary[]> {
  const { userId, filters, signal } = params;
  const path = buildAgentOSUrl(agentOSConfig.personasPath);
  const url = path.startsWith("http") ? new URL(path) : new URL(path, window.location.origin);

  const effectiveUserId = userId ?? agentOSConfig.defaultUserId;
  if (effectiveUserId) {
    url.searchParams.set("userId", effectiveUserId);
  }

  if (filters) {
    const appendAll = (key: string, values: string | string[] | undefined) => {
      if (!values) return;
      (Array.isArray(values) ? values : [values])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value && value.length > 0))
        .forEach((value) => url.searchParams.append(key, value));
    };

    appendAll("capability", filters.capability);
    appendAll("tier", filters.tier);
    if (filters.search && filters.search.trim().length > 0) {
      url.searchParams.set("search", filters.search.trim());
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: agentOSConfig.withCredentials ? "include" : "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch personas (${response.status})`);
  }

  const payload = (await response.json()) as { personas?: AgentOSPersonaSummary[] };
  return payload.personas ?? [];
}
export async function listWorkflowDefinitions(signal?: AbortSignal): Promise<WorkflowDefinition[]> {
  const response = await fetch(buildAgentOSUrl(agentOSConfig.workflowDefinitionsPath), {
    method: "GET",
    credentials: agentOSConfig.withCredentials ? "include" : "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    signal
  });

  if (!response.ok) {
    const message = `Failed to fetch workflow definitions (${response.status})`;
    throw new Error(message);
  }

  const payload = (await response.json()) as { definitions?: WorkflowDefinition[] };
  return payload.definitions ?? [];
}
