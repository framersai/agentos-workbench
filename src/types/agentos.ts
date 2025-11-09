export interface AgentOSPersonaSummary {
  id?: string;
  name?: string;
  displayName?: string;
  label?: string;
  description?: string;
  strengths?: string[];
  tags?: string[];
  activationKeywords?: string[];
  allowedCapabilities?: string[];
  personalityTraits?: Record<string, unknown>;
  [key: string]: unknown;
}
export enum AgentOSChunkType {
  TEXT_DELTA = "text_delta",
  SYSTEM_PROGRESS = "system_progress",
  TOOL_CALL_REQUEST = "tool_call_request",
  TOOL_RESULT_EMISSION = "tool_result_emission",
  UI_COMMAND = "ui_command",
  FINAL_RESPONSE = "final_response",
  ERROR = "error",
  METADATA_UPDATE = "metadata_update",
  WORKFLOW_UPDATE = "workflow_update",
  AGENCY_UPDATE = "agency_update"
}

export interface AgentOSBaseChunk {
  type: AgentOSChunkType;
  streamId: string;
  gmiInstanceId: string;
  personaId: string;
  isFinal: boolean;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCallRequestShape {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentOSTextDeltaChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.TEXT_DELTA;
  textDelta: string;
}

export interface AgentOSSystemProgressChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.SYSTEM_PROGRESS;
  message: string;
  progressPercentage?: number;
  statusCode?: string;
}

export interface AgentOSToolCallRequestChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.TOOL_CALL_REQUEST;
  toolCalls: ToolCallRequestShape[];
  rationale?: string;
}

export interface AgentOSToolResultEmissionChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.TOOL_RESULT_EMISSION;
  toolCallId: string;
  toolName: string;
  toolResult: unknown;
  isSuccess: boolean;
  errorMessage?: string;
}

export interface AgentOSFinalResponseChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.FINAL_RESPONSE;
  finalResponseText: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

export interface AgentOSWorkflowTaskSnapshot {
  status: string;
  assignedRoleId?: string;
  assignedExecutorId?: string;
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  metadata?: Record<string, unknown>;
}

export interface AgentOSWorkflowUpdateChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.WORKFLOW_UPDATE;
  workflow: {
    workflowId: string;
    definitionId: string;
    definitionVersion?: string;
    status: string;
    createdAt?: string;
    updatedAt: string;
    conversationId?: string;
    metadata?: Record<string, unknown>;
    tasks?: Record<string, AgentOSWorkflowTaskSnapshot>;
  };
}

export interface AgentOSAgencyUpdateChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.AGENCY_UPDATE;
  agency: {
    agencyId: string;
    workflowId: string;
    conversationId?: string;
    metadata?: Record<string, unknown>;
    seats: Array<{
      roleId: string;
      gmiInstanceId: string;
      personaId: string;
      metadata?: Record<string, unknown>;
    }>;
  };
}

export interface AgentOSMetadataUpdateChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.METADATA_UPDATE;
  updates: Record<string, unknown>;
}

export type AgentOSResponse =
  | AgentOSBaseChunk
  | AgentOSTextDeltaChunk
  | AgentOSSystemProgressChunk
  | AgentOSToolCallRequestChunk
  | AgentOSToolResultEmissionChunk
  | AgentOSFinalResponseChunk
  | AgentOSMetadataUpdateChunk
  | AgentOSWorkflowUpdateChunk
  | AgentOSAgencyUpdateChunk;

