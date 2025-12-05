/**
 * @file PlanningDashboard.tsx
 * @description Dashboard for visualizing and managing agent execution plans.
 * Displays active plans, their steps, dependencies, and execution progress.
 *
 * @module AgentOS-Workbench/Planning
 */

import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  Target,
  Zap,
  GitBranch,
  Activity,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';

// Types matching the AgentOS planning module
interface PlanStep {
  stepId: string;
  description: string;
  actionType: 'tool_call' | 'gmi_action' | 'human_input' | 'sub_plan' | 'reflection' | 'communication';
  toolId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  dependsOn?: string[];
  estimatedTokens?: number;
  confidence?: number;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

interface ExecutionPlan {
  planId: string;
  goal: string;
  steps: PlanStep[];
  estimatedTokens?: number;
  confidenceScore?: number;
  createdAt: string;
  status: 'draft' | 'executing' | 'paused' | 'completed' | 'failed';
  currentStepIndex: number;
}

// Mock data for demonstration
const mockPlans: ExecutionPlan[] = [
  {
    planId: 'plan-demo-1',
    goal: 'Research and summarize AI agent frameworks',
    steps: [
      {
        stepId: 'step-1',
        description: 'Search for recent AI agent framework releases',
        actionType: 'tool_call',
        toolId: 'web-search',
        status: 'completed',
        confidence: 0.9,
        durationMs: 2340,
      },
      {
        stepId: 'step-2',
        description: 'Analyze key features of each framework',
        actionType: 'reflection',
        status: 'completed',
        dependsOn: ['step-1'],
        confidence: 0.85,
        durationMs: 1820,
      },
      {
        stepId: 'step-3',
        description: 'Compare frameworks against AgentOS',
        actionType: 'gmi_action',
        status: 'in_progress',
        dependsOn: ['step-2'],
        confidence: 0.8,
      },
      {
        stepId: 'step-4',
        description: 'Generate summary report',
        actionType: 'gmi_action',
        status: 'pending',
        dependsOn: ['step-3'],
        confidence: 0.9,
      },
    ],
    estimatedTokens: 15000,
    confidenceScore: 0.86,
    createdAt: new Date(Date.now() - 300000).toISOString(),
    status: 'executing',
    currentStepIndex: 2,
  },
];

/**
 * Get icon for step action type
 */
function getActionIcon(actionType: PlanStep['actionType']) {
  switch (actionType) {
    case 'tool_call':
      return <Zap className="w-4 h-4" />;
    case 'gmi_action':
      return <Activity className="w-4 h-4" />;
    case 'human_input':
      return <Target className="w-4 h-4" />;
    case 'sub_plan':
      return <GitBranch className="w-4 h-4" />;
    case 'reflection':
      return <RotateCcw className="w-4 h-4" />;
    case 'communication':
      return <Activity className="w-4 h-4" />;
    default:
      return <Circle className="w-4 h-4" />;
  }
}

/**
 * Get status icon for a plan step
 */
function getStatusIcon(status: PlanStep['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'in_progress':
      return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
    case 'failed':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'skipped':
      return <Circle className="w-4 h-4 text-gray-400" />;
    default:
      return <Circle className="w-4 h-4 text-gray-300" />;
  }
}

/**
 * Get badge variant for status
 */
function getStatusVariant(status: ExecutionPlan['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'executing':
      return 'default';
    case 'completed':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * PlanStepItem - Renders a single step in the plan
 */
function PlanStepItem({ step, index }: { step: PlanStep; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${
        step.status === 'in_progress' ? 'border-blue-500 bg-blue-500/5' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-[var(--color-bg-secondary)] rounded"
          aria-label={expanded ? 'Collapse step details' : 'Expand step details'}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <span className="text-sm text-[var(--color-text-muted)] w-6">{index + 1}</span>
        {getStatusIcon(step.status)}
        <div className="flex items-center gap-2">
          {getActionIcon(step.actionType)}
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
            {step.actionType.replace('_', ' ')}
          </span>
        </div>
        <span className="flex-1 text-sm">{step.description}</span>
        {step.confidence && (
          <span className="text-xs text-[var(--color-text-muted)]">{Math.round(step.confidence * 100)}% conf</span>
        )}
        {step.durationMs && (
          <span className="text-xs text-[var(--color-text-muted)]">{(step.durationMs / 1000).toFixed(1)}s</span>
        )}
      </div>
      {expanded && (
        <div className="mt-3 pl-12 space-y-2 text-sm">
          {step.toolId && (
            <div className="flex gap-2">
              <span className="text-[var(--color-text-muted)]">Tool:</span>
              <code className="px-1 bg-[var(--color-bg-secondary)] rounded">{step.toolId}</code>
            </div>
          )}
          {step.dependsOn && step.dependsOn.length > 0 && (
            <div className="flex gap-2">
              <span className="text-[var(--color-text-muted)]">Depends on:</span>
              <span>{step.dependsOn.join(', ')}</span>
            </div>
          )}
          {step.error && <div className="text-red-500 p-2 bg-red-500/10 rounded">{step.error}</div>}
          {step.output && (
            <div className="p-2 bg-[var(--color-bg-secondary)] rounded">
              <pre className="text-xs overflow-auto max-h-32">{JSON.stringify(step.output, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PlanCard - Renders a complete execution plan
 */
function PlanCard({ plan }: { plan: ExecutionPlan }) {
  const completedSteps = plan.steps.filter((s) => s.status === 'completed').length;
  const progress = (completedSteps / plan.steps.length) * 100;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg">{plan.goal}</h3>
            <Badge variant={getStatusVariant(plan.status)}>{plan.status}</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Plan ID: {plan.planId} • Created{' '}
            {new Date(plan.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          {plan.status === 'executing' && (
            <Button variant="outline" size="sm">
              <Pause className="w-4 h-4 mr-1" /> Pause
            </Button>
          )}
          {plan.status === 'paused' && (
            <Button variant="outline" size="sm">
              <Play className="w-4 h-4 mr-1" /> Resume
            </Button>
          )}
          {(plan.status === 'failed' || plan.status === 'completed') && (
            <Button variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-1" /> Re-run
            </Button>
          )}
        </div>
      </div>

      {/* Progress and stats */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>
            Progress: {completedSteps}/{plan.steps.length} steps
          </span>
          <span>
            {plan.confidenceScore && `${Math.round(plan.confidenceScore * 100)}% confidence`}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-[var(--color-text-muted)]">Execution Steps</h4>
        {plan.steps.map((step, index) => (
          <PlanStepItem key={step.stepId} step={step} index={index} />
        ))}
      </div>
    </Card>
  );
}

/**
 * PlanningDashboard - Main dashboard component
 */
export function PlanningDashboard() {
  const [plans, setPlans] = useState<ExecutionPlan[]>(mockPlans);
  const [filter, setFilter] = useState<'all' | 'executing' | 'completed' | 'failed'>('all');

  // Filter plans
  const filteredPlans = plans.filter((plan) => {
    if (filter === 'all') return true;
    return plan.status === filter;
  });

  // Stats
  const stats = {
    total: plans.length,
    executing: plans.filter((p) => p.status === 'executing').length,
    completed: plans.filter((p) => p.status === 'completed').length,
    failed: plans.filter((p) => p.status === 'failed').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planning Engine</h1>
          <p className="text-[var(--color-text-muted)]">
            View and manage agent execution plans
          </p>
        </div>
        <Button>
          <Target className="w-4 h-4 mr-2" /> New Plan
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Total Plans</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.executing}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Executing</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Completed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.failed}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Failed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'executing', 'completed', 'failed'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Plans list */}
      <div className="space-y-4">
        {filteredPlans.length === 0 ? (
          <Card className="p-8 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
            <h3 className="font-medium mb-2">No plans found</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Create a new plan to get started with autonomous goal pursuit.
            </p>
          </Card>
        ) : (
          filteredPlans.map((plan) => <PlanCard key={plan.planId} plan={plan} />)
        )}
      </div>
    </div>
  );
}

