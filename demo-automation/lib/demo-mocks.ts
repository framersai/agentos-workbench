/**
 * Demo Mocks — Rich API mock data for all workbench endpoints.
 *
 * Replaces the minimal E2E test mocks with realistic, populated data
 * suitable for Playwright-based demo recording sessions.
 */

import { Page } from 'playwright';
import { createSSERouteHandler } from './sse-mock';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const PERSONAS = [
  {
    id: 'v_concierge',
    name: 'concierge',
    displayName: 'Concierge',
    description: 'General-purpose AI assistant',
    tags: ['chat', 'general'],
    allowedCapabilities: ['web_search', 'summarize', 'code_execution'],
    personalityTraits: { formality: 0.5, verbosity: 0.4, technicality: 0.6 },
  },
  {
    id: 'v_code_reviewer',
    name: 'code-reviewer',
    displayName: 'Code Reviewer',
    description: 'Reviews PRs and code quality',
    tags: ['code', 'review'],
    allowedCapabilities: ['code_execution', 'file_read', 'git_operations'],
    personalityTraits: { formality: 0.8, verbosity: 0.3, technicality: 0.95 },
  },
  {
    id: 'v_researcher',
    name: 'research-analyst',
    displayName: 'Research Analyst',
    description: 'Deep research and analysis',
    tags: ['research', 'analysis'],
    allowedCapabilities: ['web_search', 'summarize', 'data_analysis'],
    personalityTraits: { formality: 0.7, verbosity: 0.6, technicality: 0.8 },
  },
  {
    id: 'v_writer',
    name: 'creative-writer',
    displayName: 'Creative Writer',
    description: 'Stories, copy, and content creation',
    tags: ['writing', 'creative'],
    allowedCapabilities: ['summarize', 'web_search'],
    personalityTraits: { formality: 0.3, verbosity: 0.7, technicality: 0.2 },
  },
  {
    id: 'v_data_scientist',
    name: 'data-scientist',
    displayName: 'Data Scientist',
    description: 'Data analysis and ML pipelines',
    tags: ['data', 'ml', 'analysis'],
    allowedCapabilities: ['code_execution', 'data_analysis', 'file_read'],
    personalityTraits: { formality: 0.6, verbosity: 0.4, technicality: 0.9 },
  },
  {
    id: 'v_devops',
    name: 'devops-engineer',
    displayName: 'DevOps Engineer',
    description: 'Infrastructure and CI/CD pipelines',
    tags: ['devops', 'infrastructure'],
    allowedCapabilities: ['code_execution', 'file_read', 'shell_exec'],
    personalityTraits: { formality: 0.5, verbosity: 0.3, technicality: 0.85 },
  },
];

const MODELS = {
  models: [
    {
      id: 'claude-sonnet-4-0',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      inputCostPer1k: 0.003,
      outputCostPer1k: 0.015,
      contextWindow: 200000,
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      inputCostPer1k: 0.005,
      outputCostPer1k: 0.015,
      contextWindow: 128000,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      inputCostPer1k: 0.00125,
      outputCostPer1k: 0.005,
      contextWindow: 2000000,
    },
  ],
};

const WORKFLOW_DEFINITIONS = [
  {
    id: 'wf_research_report',
    name: 'Research & Report',
    description: 'Multi-step research with summarization',
    tasks: ['gather_sources', 'analyze', 'draft_report', 'review'],
    status: 'active',
  },
  {
    id: 'wf_code_pipeline',
    name: 'Code Review Pipeline',
    description: 'Automated PR review and feedback',
    tasks: ['fetch_diff', 'analyze_code', 'security_scan', 'generate_review'],
    status: 'active',
  },
];

const EVALUATION_RUNS = [
  {
    id: 'run_001',
    name: 'QA Accuracy Suite v2.1',
    status: 'completed',
    startedAt: '2026-03-03T10:00:00Z',
    completedAt: '2026-03-03T10:02:30Z',
    totalTests: 8,
    passedTests: 8,
    failedTests: 0,
    averageScore: 0.94,
    duration: 150,
  },
  {
    id: 'run_002',
    name: 'RAG Retrieval Quality',
    status: 'completed',
    startedAt: '2026-03-02T14:00:00Z',
    completedAt: '2026-03-02T14:03:00Z',
    totalTests: 12,
    passedTests: 10,
    failedTests: 2,
    averageScore: 0.87,
    duration: 180,
  },
  {
    id: 'run_003',
    name: 'Hallucination Detection',
    status: 'completed',
    startedAt: '2026-03-01T09:00:00Z',
    completedAt: '2026-03-01T09:04:00Z',
    totalTests: 15,
    passedTests: 12,
    failedTests: 3,
    averageScore: 0.78,
    duration: 240,
  },
];

const EVALUATION_TEST_CASES = [
  { id: 'tc_001', name: 'greeting_response', description: 'Verify appropriate greeting', category: 'basic' },
  { id: 'tc_002', name: 'knowledge_retrieval', description: 'Test factual accuracy', category: 'accuracy' },
  { id: 'tc_003', name: 'multi_turn_context', description: 'Context preservation across turns', category: 'context' },
  { id: 'tc_004', name: 'tool_call_accuracy', description: 'Correct tool selection', category: 'tools' },
  { id: 'tc_005', name: 'response_format', description: 'Output formatting compliance', category: 'format' },
  { id: 'tc_006', name: 'edge_case_handling', description: 'Graceful edge case handling', category: 'robustness' },
  { id: 'tc_007', name: 'latency_threshold', description: 'Response under 2s', category: 'performance' },
  { id: 'tc_008', name: 'safety_guardrails', description: 'Content safety compliance', category: 'safety' },
];

const PLANNING_PLANS = [
  {
    planId: 'plan_001',
    goal: 'Deploy feature to production',
    status: 'executing',
    createdAt: '2026-03-03T09:00:00Z',
    currentStepIndex: 2,
    steps: [
      {
        stepId: 's1',
        description: 'Run test suite',
        actionType: 'tool_call',
        status: 'completed',
        confidence: 0.95,
        estimatedTokens: 500,
      },
      {
        stepId: 's2',
        description: 'Analyze code coverage',
        actionType: 'reflection',
        status: 'completed',
        confidence: 0.88,
        estimatedTokens: 300,
      },
      {
        stepId: 's3',
        description: 'Generate PR review',
        actionType: 'gmi_action',
        status: 'in_progress',
        confidence: 0.72,
        estimatedTokens: 800,
      },
      {
        stepId: 's4',
        description: 'Deploy to staging',
        actionType: 'tool_call',
        status: 'pending',
        confidence: 0.65,
        estimatedTokens: 200,
      },
    ],
  },
  {
    planId: 'plan_002',
    goal: 'Research competitive landscape',
    status: 'completed',
    createdAt: '2026-03-02T14:00:00Z',
    currentStepIndex: 3,
    steps: [
      {
        stepId: 's1',
        description: 'Web research',
        actionType: 'tool_call',
        status: 'completed',
        confidence: 0.92,
      },
      {
        stepId: 's2',
        description: 'Summarize findings',
        actionType: 'gmi_action',
        status: 'completed',
        confidence: 0.85,
      },
      {
        stepId: 's3',
        description: 'Draft report',
        actionType: 'gmi_action',
        status: 'completed',
        confidence: 0.90,
      },
    ],
  },
];

const TELEMETRY_TASK_OUTCOMES = {
  windows: [
    {
      scopeKey: 'global',
      scopeMode: 'global',
      organizationId: null,
      personaId: null,
      sampleCount: 47,
      successCount: 44,
      partialCount: 2,
      failedCount: 1,
      successRate: 0.94,
      averageScore: 0.91,
      weightedSuccessRate: 0.92,
      updatedAt: '2026-03-03T12:00:00Z',
      windowStartAt: '2026-03-02T12:00:00Z',
      windowEndAt: '2026-03-03T12:00:00Z',
    },
    {
      scopeKey: 'org::demo-org',
      scopeMode: 'organization',
      organizationId: 'demo-org',
      personaId: null,
      sampleCount: 32,
      successCount: 30,
      partialCount: 1,
      failedCount: 1,
      successRate: 0.94,
      averageScore: 0.90,
      weightedSuccessRate: 0.91,
      updatedAt: '2026-03-03T11:30:00Z',
      windowStartAt: '2026-03-02T11:30:00Z',
      windowEndAt: '2026-03-03T11:30:00Z',
    },
    {
      scopeKey: 'org::demo-org::persona::v_concierge',
      scopeMode: 'organization_persona',
      organizationId: 'demo-org',
      personaId: 'v_concierge',
      sampleCount: 18,
      successCount: 17,
      partialCount: 1,
      failedCount: 0,
      successRate: 0.94,
      averageScore: 0.93,
      weightedSuccessRate: 0.93,
      updatedAt: '2026-03-03T11:00:00Z',
      windowStartAt: '2026-03-02T11:00:00Z',
      windowEndAt: '2026-03-03T11:00:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 25,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
    sortBy: 'updated_at' as const,
    sortDir: 'desc' as const,
  },
  totals: {
    windowCount: 3,
    returnedWindowCount: 3,
    sampleCount: 97,
    successCount: 91,
    partialCount: 4,
    failedCount: 2,
    successRate: 0.94,
    averageScore: 0.91,
    weightedSuccessRate: 0.92,
  },
  filters: {
    scopeMode: null,
    organizationId: null,
    personaId: null,
    scopeContains: null,
    limit: 25,
    page: 1,
    sortBy: 'updated_at',
    sortDir: 'desc',
    includeEntries: false,
  },
};

const TELEMETRY_ALERTS = {
  alerts: [
    {
      alertId: 'alert_001',
      scopeKey: 'global',
      scopeMode: 'global' as const,
      organizationId: null,
      personaId: null,
      severity: 'warning',
      reason: 'Latency threshold exceeded',
      threshold: 2.0,
      value: 2.4,
      sampleCount: 47,
      alertTimestamp: '2026-03-03T11:45:00Z',
      streamId: 'demo-stream-001',
      sessionId: 'session-demo-001',
      gmiInstanceId: 'gmi-demo-001',
      personaStreamId: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      createdAt: '2026-03-03T11:45:00Z',
      updatedAt: '2026-03-03T11:45:00Z',
    },
    {
      alertId: 'alert_002',
      scopeKey: 'org::demo-org::persona::v_code_reviewer',
      scopeMode: 'organization_persona' as const,
      organizationId: 'demo-org',
      personaId: 'v_code_reviewer',
      severity: 'warning',
      reason: 'Weighted success rate below threshold',
      threshold: 0.8,
      value: 0.76,
      sampleCount: 25,
      alertTimestamp: '2026-03-02T16:30:00Z',
      streamId: 'demo-stream-002',
      sessionId: 'session-demo-002',
      gmiInstanceId: 'gmi-code-001',
      personaStreamId: null,
      acknowledgedAt: '2026-03-02T17:00:00Z',
      acknowledgedBy: 'agentos-workbench-user',
      createdAt: '2026-03-02T16:30:00Z',
      updatedAt: '2026-03-02T17:00:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 25,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
    sortBy: 'alert_timestamp' as const,
    sortDir: 'desc' as const,
  },
  totals: {
    alertCount: 2,
    acknowledgedCount: 1,
    unacknowledgedCount: 1,
    criticalCount: 0,
  },
  filters: {
    scopeMode: null,
    organizationId: null,
    personaId: null,
    scopeContains: null,
    severity: null,
    acknowledged: null,
    limit: 25,
    page: 1,
    sortBy: 'alert_timestamp',
    sortDir: 'desc',
  },
};

const TELEMETRY_CONFIG = {
  source: 'runtime',
  tenantRouting: {
    mode: 'single_tenant',
    defaultOrganizationId: 'demo-org',
    strictOrganizationIsolation: false,
  },
  taskOutcomeTelemetry: {
    enabled: true,
    rollingWindowSize: 100,
    scope: 'global',
    emitAlerts: true,
    alertBelowWeightedSuccessRate: 0.8,
    alertMinSamples: 10,
    alertCooldownMs: 60000,
  },
  adaptiveExecution: {
    enabled: true,
    minSamples: 5,
    minWeightedSuccessRate: 0.7,
    forceAllToolsWhenDegraded: true,
    forceFailOpenWhenDegraded: false,
  },
  turnPlanning: {
    enabled: true,
    defaultToolFailureMode: 'fail_open',
    allowRequestOverrides: true,
    discovery: {
      enabled: true,
      defaultToolSelectionMode: 'discovered',
      recallProfile: 'balanced',
      onlyAvailable: true,
      includePromptContext: true,
      maxRetries: 2,
      retryBackoffMs: 500,
    },
  },
};

const TELEMETRY_ALERT_RETENTION_STATUS = {
  config: {
    enabled: true,
    retentionDays: 30,
    maxRows: 10000,
    pruneIntervalMs: 3600000,
  },
  lastPruneAt: '2026-03-03T06:00:00Z',
  pruneInFlight: false,
  lastSummary: {
    config: {
      enabled: true,
      retentionDays: 30,
      maxRows: 10000,
      pruneIntervalMs: 3600000,
    },
    deletedByAge: 0,
    deletedByOverflow: 0,
    totalDeleted: 0,
    remainingRows: 2,
    prunedAt: '2026-03-03T06:00:00Z',
  },
};

// ---------------------------------------------------------------------------
// Route installation
// ---------------------------------------------------------------------------

/**
 * Install rich API mocks for demo recording.
 *
 * @param page      Playwright Page instance (must be created before calling).
 * @param scenarioId  Selects which SSE stream scenario to use for the
 *                    `/api/agentos/stream` route. Defaults to `'streaming'`.
 */
export async function installDemoMocks(page: Page, scenarioId: string): Promise<void> {
  // --- Personas ---
  await page.route('**/api/agentos/personas**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PERSONAS),
    });
  });

  // --- Models ---
  await page.route('**/api/agentos/models**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MODELS),
    });
  });

  // --- Workflow definitions ---
  await page.route('**/api/agentos/workflows/definitions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(WORKFLOW_DEFINITIONS),
    });
  });

  // --- Evaluation runs ---
  await page.route('**/api/evaluation/runs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EVALUATION_RUNS),
    });
  });

  // --- Evaluation test cases ---
  await page.route('**/api/evaluation/test-cases**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EVALUATION_TEST_CASES),
    });
  });

  // --- Planning plans ---
  await page.route('**/api/planning/plans**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PLANNING_PLANS),
    });
  });

  // --- Telemetry: task outcomes ---
  await page.route('**/api/agentos/telemetry/task-outcomes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TELEMETRY_TASK_OUTCOMES),
    });
  });

  // --- Telemetry: config ---
  await page.route('**/api/agentos/telemetry/config**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TELEMETRY_CONFIG),
    });
  });

  // --- Telemetry: alerts (must be registered before the more specific sub-routes) ---
  // Alert acknowledgement
  await page.route('**/api/agentos/telemetry/alerts/*/acknowledge', async (route) => {
    const url = route.request().url();
    const match = url.match(/alerts\/([^/]+)\/acknowledge/);
    const alertId = match ? decodeURIComponent(match[1]) : 'unknown';
    const alert = TELEMETRY_ALERTS.alerts.find((a) => a.alertId === alertId);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        alert: alert
          ? {
              ...alert,
              acknowledgedAt: new Date().toISOString(),
              acknowledgedBy: 'agentos-workbench-user',
            }
          : { alertId, acknowledgedAt: new Date().toISOString() },
      }),
    });
  });

  // Alert retention status
  await page.route('**/api/agentos/telemetry/alerts/retention**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TELEMETRY_ALERT_RETENTION_STATUS),
    });
  });

  // Alert prune
  await page.route('**/api/agentos/telemetry/alerts/prune**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: TELEMETRY_ALERT_RETENTION_STATUS.lastSummary,
        status: TELEMETRY_ALERT_RETENTION_STATUS,
      }),
    });
  });

  // Alert history (general query — must come after the more specific sub-routes above)
  await page.route('**/api/agentos/telemetry/alerts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TELEMETRY_ALERTS),
    });
  });

  // --- SSE stream ---
  await page.route('**/api/agentos/stream**', createSSERouteHandler(scenarioId));
}
