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
  AGENCY_UPDATE = "agency_update",
  /** RAG retrieval results chunk - contains retrieved context */
  RAG_RETRIEVAL = "rag_retrieval",
  /** RAG ingestion status chunk - reports document ingestion progress */
  RAG_INGESTION = "rag_ingestion"
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

export interface AgentOSTaskOutcomeMetadata {
  status: "success" | "partial" | "failed";
  score: number;
  reason?: string;
  source?: "heuristic" | "request_override" | string;
}

export interface AgentOSTaskOutcomeKpiSummary {
  scopeKey: string;
  scopeMode: "global" | "organization" | "user" | "session" | string;
  windowSize: number;
  sampleCount: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  successRate: number;
  averageScore: number;
  weightedSuccessRate: number;
  timestamp: string;
}

export interface AgentOSTaskOutcomeAlert {
  scopeKey: string;
  severity: "warning" | "critical" | string;
  reason: string;
  threshold: number;
  value: number;
  sampleCount: number;
  timestamp: string;
}

export interface AgentOSMetadataUpdates extends Record<string, unknown> {
  taskOutcome?: AgentOSTaskOutcomeMetadata;
  taskOutcomeKpi?: AgentOSTaskOutcomeKpiSummary;
  taskOutcomeAlert?: AgentOSTaskOutcomeAlert;
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
  updates: AgentOSMetadataUpdates;
}

/**
 * RAG retrieval result chunk - emitted when context is retrieved from RAG memory.
 * Contains the retrieved chunks and their similarity scores.
 */
export interface AgentOSRagRetrievalChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.RAG_RETRIEVAL;
  /** The original query used for retrieval */
  query: string;
  /** Retrieved chunks with content and scores */
  retrievedChunks: Array<{
    /** Unique identifier for the chunk */
    chunkId: string;
    /** Parent document identifier */
    documentId: string;
    /** The text content of the chunk */
    content: string;
    /** Similarity score (0-1, higher is more relevant) */
    score: number;
    /** Optional chunk metadata */
    metadata?: Record<string, unknown>;
  }>;
  /** Total number of results found (may be more than returned) */
  totalResults: number;
  /** Processing time in milliseconds */
  processingTimeMs?: number;
}

/**
 * RAG ingestion status chunk - emitted when documents are ingested into RAG memory.
 * Reports the status and results of the ingestion operation.
 */
export interface AgentOSRagIngestionChunk extends AgentOSBaseChunk {
  type: AgentOSChunkType.RAG_INGESTION;
  /** Document identifier */
  documentId: string;
  /** Collection the document was ingested into */
  collectionId: string;
  /** Ingestion status */
  status: 'success' | 'partial' | 'failed';
  /** Number of chunks created from the document */
  chunksCreated?: number;
  /** Error message if ingestion failed */
  errorMessage?: string;
  /** Processing time in milliseconds */
  processingTimeMs?: number;
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
  | AgentOSAgencyUpdateChunk
  | AgentOSRagRetrievalChunk
  | AgentOSRagIngestionChunk;
