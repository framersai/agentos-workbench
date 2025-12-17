import {
  PersonaDefinition,
  WorkflowDefinition,
  Extension,
  Tool,
  AgentOSModelInfo,
  GuardrailDescriptor,
  AgencyExecutionRecord,
  EvaluationRun,
  MarketplaceItem
} from './types';

export const mockPersonas: PersonaDefinition[] = [
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Expert in finding and synthesizing information.',
    capabilities: ['search', 'summarization'],
    tier: 'basic'
  },
  {
    id: 'coder',
    name: 'Coder',
    description: 'Writes and debugs code.',
    capabilities: ['coding', 'debugging'],
    tier: 'pro'
  }
];

export const mockWorkflows: WorkflowDefinition[] = [
  {
    id: 'research-and-report',
    name: 'Research and Report',
    description: 'Conducts research on a topic and generates a report.',
    steps: []
  }
];

export const mockExtensions: Extension[] = [
  {
    id: 'ext-search',
    name: 'Web Search',
    package: '@agentos/search',
    version: '1.0.0',
    description: 'Provides web search capabilities.',
    category: 'utility',
    installed: true,
    verified: true,
    tools: ['google-search']
  }
];

export const mockTools: Tool[] = [
  {
    id: 'google-search',
    name: 'Google Search',
    description: 'Search the web using Google.',
    extension: 'ext-search',
    hasSideEffects: false
  }
];

export const mockModels: AgentOSModelInfo[] = [
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'OpenAI',
    pricing: {
      inputCostPer1K: 0.03,
      outputCostPer1K: 0.06
    }
  },
  {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'Google',
    pricing: {
      inputCostPer1K: 0.001,
      outputCostPer1K: 0.002
    }
  }
];

export const mockGuardrails: GuardrailDescriptor[] = [
  {
    id: 'pii-filter',
    package: '@guardrails/pii',
    version: '1.2.0',
    displayName: 'PII Filter',
    description: 'Detects and redacts PII.',
    category: 'privacy',
    verified: true
  }
];

export const mockExecutions: AgencyExecutionRecord[] = [
  {
    agencyId: 'agency-123',
    workflowId: 'research-and-report',
    userId: 'user-1',
    status: 'completed',
    createdAt: new Date().toISOString()
  }
];

export const mockEvaluationRuns: EvaluationRun[] = [
  {
    id: 'run-1',
    name: 'Baseline Test',
    status: 'completed',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date().toISOString(),
    totalTests: 10,
    passedTests: 8,
    failedTests: 2,
    averageScore: 0.85
  }
];

export const mockMarketplaceItems: MarketplaceItem[] = [
  {
    id: 'agent-writer',
    type: 'agent',
    name: 'Creative Writer',
    description: 'An agent specialized in creative writing.',
    version: '1.0.0',
    publisher: {
      id: 'pub-1',
      name: 'AgentOS',
      verified: true
    },
    categories: ['productivity'],
    tags: ['writing', 'creative'],
    license: 'MIT',
    pricing: {
      model: 'free'
    },
    stats: {
      downloads: 1200,
      activeInstalls: 500,
      views: 5000
    },
    ratings: {
      average: 4.5,
      count: 20
    }
  }
];
