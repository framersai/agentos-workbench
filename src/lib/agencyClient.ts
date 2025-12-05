/**
 * @fileoverview Agency Streaming Client - Standalone AgentOS Integration
 * @description Client-side utilities for multi-GMI agency workflow streaming using AgentOS directly.
 * 
 * **Architecture:**
 * - Uses `@framers/agentos` package directly (no backend HTTP required)
 * - Creates AgentOS instance with IndexedDB storage adapter
 * - Executes multi-GMI workflows via AgentOS.processRequest with workflowRequest
 * - Streams chunks directly from AgentOS async generator
 * 
 * **Usage:**
 * ```typescript
 * const cleanup = streamAgencyWorkflow(
 *   {
 *     goal: "Analyze and report",
 *     roles: [
 *       { roleId: "analyst", personaId: "v_researcher", instruction: "Calculate metrics" },
*       { roleId: "writer", personaId: "v_researcher", instruction: "Draft report" }
 *     ],
 *     userId: "user-123",
 *     conversationId: "conv-456"
 *   },
 *   {
 *     onChunk: (chunk) => console.log(chunk),
 *     onDone: () => console.log('Complete'),
 *     onError: (error) => console.error(error)
 *   }
 * );
 * ```
 */

import type { AgentOSResponse } from '@/types/agentos';

/** Configuration for a single agent role */
export interface AgentRoleConfig {
  roleId: string;
  personaId: string;
  instruction: string;
  priority?: number;
}

/** Input for starting an agency workflow */
export interface AgencyStreamInput {
  goal: string;
  roles: AgentRoleConfig[];
  userId: string;
  conversationId: string;
  outputFormat?: 'json' | 'csv' | 'markdown' | 'text';
}

/** Callbacks for agency stream events */
export interface AgencyStreamCallbacks {
  onChunk?: (chunk: AgentOSResponse) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Gets or creates the AgentOS instance for standalone client-side use.
 * Uses IndexedDB storage adapter for persistence.
 * 
 * NOTE: Client-side AgentOS initialization requires full config (gmiManagerConfig, orchestratorConfig, etc.).
 * This is currently disabled - use backend API instead via agentosClient.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getAgentOS(): Promise<never> {
  throw new Error(
    'Client-side AgentOS initialization is not yet supported. ' +
    'Please use the backend API via agentosClient.ts instead. ' +
    'For agency workflows, use the /api/agentos/agency/stream endpoint.'
  );
  
  // TODO: Implement full AgentOS config for client-side use if needed
  // This requires providing all required config fields:
  // - gmiManagerConfig
  // - orchestratorConfig
  // - promptEngineConfig
  // - toolOrchestratorConfig
  // - toolPermissionManagerConfig
  // - conversationManagerConfig
  // - streamingManagerConfig
  // - modelProviderManagerConfig
  // - defaultPersonaId
  // - authService (can be mock for client-side)
  // - subscriptionService (can be mock for client-side)
  // - prisma (optional if storageAdapter provided)
}

/**
 * Streams a multi-GMI agency workflow using AgentOS directly.
 * 
 * **How it works:**
 * 1. Creates a workflow definition dynamically from roles
 * 2. Starts workflow via AgentOS.startWorkflow()
 * 3. Processes requests for each role/GMI in parallel
 * 4. Streams chunks from AgentOS.processRequest() async generator
 * 
 * @param input - Agency workflow configuration
 * @param callbacks - Event handlers for chunks, completion, and errors
 * @returns Cleanup function to abort the stream
 */
export async function streamAgencyWorkflow(
  _input: AgencyStreamInput,
  callbacks: AgencyStreamCallbacks = {}
): Promise<() => void> {
  const error = new Error('Client-side AgentOS streaming is not supported; use backend /api/agentos/agency endpoints.');
  callbacks.onError?.(error);
  return () => undefined;
}
