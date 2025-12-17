// Backend types matching frontend interfaces

export interface PersonaDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tier: 'basic' | 'pro' | 'enterprise';
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: unknown[];
}

export interface Extension {
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

export interface Tool {
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

export interface AgencyExecutionRecord {
  agencyId: string;
  workflowId: string;
  userId: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface EvaluationRun {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageScore: number;
  duration?: number;
}

export interface MarketplaceItem {
  id: string;
  type: 'agent' | 'persona' | 'workflow' | 'extension' | 'template';
  name: string;
  description: string;
  version: string;
  publisher: {
    id: string;
    name: string;
    verified: boolean;
  };
  categories: string[];
  tags: string[];
  license: string;
  pricing: {
    model: string;
    priceInCents?: number;
  };
  stats: {
    downloads: number;
    activeInstalls: number;
    views: number;
  };
  ratings: {
    average: number;
    count: number;
  };
  iconUrl?: string;
}
