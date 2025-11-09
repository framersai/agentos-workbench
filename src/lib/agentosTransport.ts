import type { AgentOSResponse } from "@/types/agentos";

export interface ConversationMessage {
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
  userApiKeys?: Record<string, string>;
}

export interface AgentOSStreamHandlers {
  onChunk: (chunk: AgentOSResponse) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

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
