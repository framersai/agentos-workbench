export interface WorkflowRoleDefinition {
  roleId: string;
  displayName: string;
  description?: string;
  personaId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowTaskDefinitionSummary {
  id: string;
  name: string;
  description?: string;
}

export interface WorkflowDefinition {
  id: string;
  version?: string;
  displayName: string;
  description?: string;
  roles?: WorkflowRoleDefinition[];
  tasks?: WorkflowTaskDefinitionSummary[];
  metadata?: Record<string, unknown>;
}
