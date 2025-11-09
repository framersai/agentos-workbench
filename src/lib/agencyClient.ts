/**
 * @fileoverview Agency Streaming Client - Standalone AgentOS Integration
 * @description Client-side utilities for multi-GMI agency workflow streaming using AgentOS directly.
 * 
 * **Architecture:**
 * - Uses `@agentos/core` package directly (no backend HTTP required)
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
 *       { roleId: "writer", personaId: "nerf_generalist", instruction: "Draft report" }
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

import { AgentOS } from '@agentos/core';
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
async function getAgentOS(): Promise<AgentOS> {
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
  input: AgencyStreamInput,
  callbacks: AgencyStreamCallbacks = {}
): Promise<() => void> {
  let aborted = false;
  
  (async () => {
    try {
      const agentOS = await getAgentOS();
      
      // Create workflow definition from roles
      const workflowDefinition = {
        id: `agency_${Date.now()}`,
        version: '1.0.0',
        name: `Agency: ${input.goal}`,
        description: `Multi-GMI coordination for: ${input.goal}`,
        roles: input.roles.map((role) => ({
          roleId: role.roleId,
          personaId: role.personaId,
          metadata: { instruction: role.instruction, priority: role.priority },
        })),
        tasks: input.roles.map((role, index) => ({
          id: `task_${role.roleId}`,
          name: `Execute ${role.roleId}`,
          executor: {
            type: 'gmi' as const,
            roleId: role.roleId,
            personaId: role.personaId,
          },
          dependencies: index === 0 ? [] : [`task_${input.roles[index - 1].roleId}`],
        })),
      };

      // Register workflow definition
      await agentOS.registerWorkflowDefinition(workflowDefinition);

      // Start workflow
      const workflowInstance = await agentOS.startWorkflow(workflowDefinition.id, {
        userId: input.userId,
        sessionId: input.conversationId,
        conversationId: input.conversationId,
        selectedPersonaId: input.roles[0]?.personaId,
        textInput: `Agency Goal: ${input.goal}\n\nExecute all roles in parallel.`,
      }, {
        workflowId: `workflow_${input.conversationId}`,
        conversationId: input.conversationId,
        createdByUserId: input.userId,
        metadata: { goal: input.goal, roles: input.roles },
      });

      // Process requests for each role in parallel
      const rolePromises = input.roles.map(async (role) => {
        if (aborted) return;

        const roleInput = {
          userId: input.userId,
          sessionId: `${input.conversationId}_${role.roleId}`,
          conversationId: input.conversationId,
          selectedPersonaId: role.personaId,
          textInput: `**Agency Goal:** ${input.goal}\n\n**Your Role (${role.roleId}):** ${role.instruction}`,
          workflowRequest: {
            definitionId: workflowDefinition.id,
            workflowId: workflowInstance.workflowId,
            conversationId: input.conversationId,
          },
        };

        // Stream chunks from AgentOS
        for await (const chunk of agentOS.processRequest(roleInput)) {
          if (aborted) break;
          callbacks.onChunk?.(chunk);
        }
      });

      // Wait for all roles to complete
      await Promise.all(rolePromises);

      if (!aborted) {
        callbacks.onDone?.();
      }
    } catch (error) {
      if (!aborted) {
        callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  })();

  return () => {
    aborted = true;
  };
}
