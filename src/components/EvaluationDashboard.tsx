/**
 * @file EvaluationDashboard.tsx
 * @description Evaluation dashboard for running, viewing, and comparing
 * agent evaluation benchmarks and test runs.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  BarChart2,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Filter,
  Plus,
  Trash2,
  Eye,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Tabs } from './ui/Tabs';
import { Progress } from './ui/Progress';

// Types
interface EvaluationRun {
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

interface TestCase {
  id: string;
  name: string;
  input: string;
  expectedOutput: string;
  category: string;
}

interface TestResult {
  testCaseId: string;
  testCaseName: string;
  passed: boolean;
  score: number;
  actualOutput?: string;
  error?: string;
  duration: number;
  metrics: Array<{
    name: string;
    score: number;
    threshold: number;
    passed: boolean;
  }>;
}

interface EvaluationDashboardProps {
  /** API endpoint for evaluations */
  apiEndpoint?: string;
  /** Agent ID to evaluate */
  agentId?: string;
  /** Callback when evaluation completes */
  onEvaluationComplete?: (run: EvaluationRun) => void;
}

/**
 * Evaluation dashboard component
 */
export function EvaluationDashboard({
  apiEndpoint = '/api/evaluation',
  agentId,
  onEvaluationComplete,
}: EvaluationDashboardProps) {
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<EvaluationRun | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('runs');
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);

  // Fetch evaluation runs
  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/runs`);
      if (response.ok) {
        const data = await response.json();
        setRuns(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch evaluation runs:', error);
      // Use mock data
      setRuns(getMockRuns());
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint]);

  // Fetch results for a run
  const fetchResults = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`${apiEndpoint}/runs/${runId}/results`);
      if (response.ok) {
        const data = await response.json();
        setResults(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
      setResults(getMockResults());
    }
  }, [apiEndpoint]);

  // Fetch test cases
  const fetchTestCases = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}/test-cases`);
      if (response.ok) {
        const data = await response.json();
        setTestCases(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch test cases:', error);
      setTestCases(getMockTestCases());
    }
  }, [apiEndpoint]);

  useEffect(() => {
    fetchRuns();
    fetchTestCases();
  }, [fetchRuns, fetchTestCases]);

  useEffect(() => {
    if (selectedRun) {
      fetchResults(selectedRun.id);
    }
  }, [selectedRun, fetchResults]);

  // Start a new evaluation run
  const startEvaluation = async () => {
    setIsRunning(true);
    setRunProgress(0);

    try {
      const response = await fetch(`${apiEndpoint}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, testCaseIds: testCases.map(tc => tc.id) }),
      });

      if (response.ok) {
        const run = await response.json();
        setRuns(prev => [run, ...prev]);
        setSelectedRun(run);

        // Simulate progress
        const interval = setInterval(() => {
          setRunProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setIsRunning(false);
              onEvaluationComplete?.(run);
              return 100;
            }
            return prev + 10;
          });
        }, 500);
      }
    } catch (error) {
      console.error('Failed to start evaluation:', error);
      setIsRunning(false);
    }
  };

  // Get status icon
  const getStatusIcon = (status: string, size = 'w-4 h-4') => {
    switch (status) {
      case 'completed':
        return <CheckCircle className={`${size} text-green-500`} />;
      case 'failed':
        return <XCircle className={`${size} text-red-500`} />;
      case 'running':
        return <Clock className={`${size} text-yellow-500 animate-pulse`} />;
      default:
        return <Clock className={`${size} text-muted`} />;
    }
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Render run card
  const renderRunCard = (run: EvaluationRun) => (
    <Card
      key={run.id}
      className={`p-4 cursor-pointer hover:border-accent transition-colors ${
        selectedRun?.id === run.id ? 'border-accent' : ''
      }`}
      onClick={() => setSelectedRun(run)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon(run.status, 'w-5 h-5')}
          <div>
            <h3 className="font-medium">{run.name}</h3>
            <p className="text-sm text-muted">
              {new Date(run.startedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <Badge
          variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'secondary'}
        >
          {run.status}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-sm">
        <div className="text-center">
          <div className="font-medium">{run.totalTests}</div>
          <div className="text-muted text-xs">Total</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-green-500">{run.passedTests}</div>
          <div className="text-muted text-xs">Passed</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-red-500">{run.failedTests}</div>
          <div className="text-muted text-xs">Failed</div>
        </div>
        <div className="text-center">
          <div className="font-medium">{(run.averageScore * 100).toFixed(0)}%</div>
          <div className="text-muted text-xs">Score</div>
        </div>
      </div>

      {run.status === 'completed' && (
        <div className="mt-3">
          <Progress
            value={(run.passedTests / run.totalTests) * 100}
            className="h-2"
          />
        </div>
      )}
    </Card>
  );

  // Render results table
  const renderResultsTable = () => (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-elevated">
          <tr>
            <th className="px-4 py-2 text-left">Test Case</th>
            <th className="px-4 py-2 text-center">Status</th>
            <th className="px-4 py-2 text-center">Score</th>
            <th className="px-4 py-2 text-center">Duration</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {results.map(result => (
            <tr key={result.testCaseId} className="hover:bg-surface-elevated/50">
              <td className="px-4 py-3">
                <div className="font-medium">{result.testCaseName}</div>
              </td>
              <td className="px-4 py-3 text-center">
                {result.passed ? (
                  <Badge variant="success" size="sm">Passed</Badge>
                ) : (
                  <Badge variant="danger" size="sm">Failed</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={result.score >= 0.8 ? 'text-green-500' : result.score >= 0.5 ? 'text-yellow-500' : 'text-red-500'}>
                  {(result.score * 100).toFixed(0)}%
                </span>
              </td>
              <td className="px-4 py-3 text-center text-muted">
                {formatDuration(result.duration)}
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render metrics breakdown
  const renderMetricsBreakdown = () => {
    if (!selectedRun) return null;

    const metricStats = results.reduce((acc, result) => {
      result.metrics.forEach(metric => {
        if (!acc[metric.name]) {
          acc[metric.name] = { total: 0, passed: 0, avgScore: 0 };
        }
        acc[metric.name].total++;
        if (metric.passed) acc[metric.name].passed++;
        acc[metric.name].avgScore += metric.score;
      });
      return acc;
    }, {} as Record<string, { total: number; passed: number; avgScore: number }>);

    Object.keys(metricStats).forEach(key => {
      metricStats[key].avgScore /= metricStats[key].total;
    });

    return (
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(metricStats).map(([name, stats]) => (
          <Card key={name} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{name}</span>
              <span className={stats.avgScore >= 0.8 ? 'text-green-500' : stats.avgScore >= 0.5 ? 'text-yellow-500' : 'text-red-500'}>
                {(stats.avgScore * 100).toFixed(0)}%
              </span>
            </div>
            <Progress value={stats.avgScore * 100} className="h-2" />
            <div className="mt-2 text-sm text-muted">
              {stats.passed}/{stats.total} passed
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // Render test case editor
  const renderTestCaseEditor = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Test Cases ({testCases.length})</h3>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Test Case
        </Button>
      </div>

      <div className="space-y-2">
        {testCases.map(tc => (
          <Card key={tc.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium">{tc.name}</h4>
                <p className="text-sm text-muted mt-1 truncate">{tc.input}</p>
                <Badge variant="secondary" size="sm" className="mt-2">
                  {tc.category}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-divider">
        <h1 className="text-xl font-semibold">Evaluation Dashboard</h1>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button variant="secondary" onClick={() => setIsRunning(false)}>
              <Pause className="w-4 h-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button onClick={startEvaluation} disabled={testCases.length === 0}>
              <Play className="w-4 h-4 mr-2" />
              Run Evaluation
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar when running */}
      {isRunning && (
        <div className="px-4 py-2 border-b border-divider bg-surface-elevated">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">Running evaluation...</span>
            <Progress value={runProgress} className="flex-1 h-2" />
            <span className="text-sm font-medium">{runProgress}%</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="px-4 pt-2"
      >
        <Tabs.List>
          <Tabs.Trigger value="runs">
            <BarChart2 className="w-4 h-4 mr-2" />
            Runs ({runs.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="test-cases">
            <FileText className="w-4 h-4 mr-2" />
            Test Cases ({testCases.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="compare">
            <TrendingUp className="w-4 h-4 mr-2" />
            Compare
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {/* Content */}
      <div className="flex-1 flex min-h-0 p-4 gap-4">
        {activeTab === 'runs' && (
          <>
            {/* Runs list */}
            <div className="w-80 flex-shrink-0 space-y-3 overflow-auto">
              {loading ? (
                <div className="text-center py-8 text-muted">Loading...</div>
              ) : runs.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  No evaluation runs yet. Start one to begin testing.
                </div>
              ) : (
                runs.map(renderRunCard)
              )}
            </div>

            {/* Results panel */}
            <div className="flex-1 bg-surface-elevated rounded-lg overflow-hidden">
              {selectedRun ? (
                <div className="h-full flex flex-col">
                  {/* Run header */}
                  <div className="p-4 border-b border-divider">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">{selectedRun.name}</h2>
                        <p className="text-sm text-muted">
                          {new Date(selectedRun.startedAt).toLocaleString()}
                          {selectedRun.duration && ` • ${formatDuration(selectedRun.duration)}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Summary stats */}
                    <div className="mt-4 grid grid-cols-4 gap-4">
                      <Card className="p-3 text-center">
                        <div className="text-2xl font-bold">{selectedRun.totalTests}</div>
                        <div className="text-xs text-muted">Total Tests</div>
                      </Card>
                      <Card className="p-3 text-center">
                        <div className="text-2xl font-bold text-green-500">{selectedRun.passedTests}</div>
                        <div className="text-xs text-muted">Passed</div>
                      </Card>
                      <Card className="p-3 text-center">
                        <div className="text-2xl font-bold text-red-500">{selectedRun.failedTests}</div>
                        <div className="text-xs text-muted">Failed</div>
                      </Card>
                      <Card className="p-3 text-center">
                        <div className="text-2xl font-bold">{(selectedRun.averageScore * 100).toFixed(0)}%</div>
                        <div className="text-xs text-muted">Avg Score</div>
                      </Card>
                    </div>
                  </div>

                  {/* Results content */}
                  <div className="flex-1 overflow-auto">
                    <Tabs defaultValue="results" className="h-full">
                      <div className="px-4 border-b border-divider">
                        <Tabs.List>
                          <Tabs.Trigger value="results">Results</Tabs.Trigger>
                          <Tabs.Trigger value="metrics">Metrics</Tabs.Trigger>
                        </Tabs.List>
                      </div>
                      <Tabs.Content value="results" className="p-4">
                        {renderResultsTable()}
                      </Tabs.Content>
                      <Tabs.Content value="metrics" className="p-4">
                        {renderMetricsBreakdown()}
                      </Tabs.Content>
                    </Tabs>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted">
                  Select a run to view results
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'test-cases' && (
          <div className="flex-1 overflow-auto">
            {renderTestCaseEditor()}
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="flex-1 flex items-center justify-center text-muted">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select multiple runs to compare results</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mock data
function getMockRuns(): EvaluationRun[] {
  return [
    {
      id: '1',
      name: 'Evaluation Run #1',
      status: 'completed',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date(Date.now() - 3500000).toISOString(),
      totalTests: 20,
      passedTests: 18,
      failedTests: 2,
      averageScore: 0.87,
      duration: 100000,
    },
    {
      id: '2',
      name: 'Evaluation Run #2',
      status: 'completed',
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      completedAt: new Date(Date.now() - 7100000).toISOString(),
      totalTests: 20,
      passedTests: 16,
      failedTests: 4,
      averageScore: 0.78,
      duration: 100000,
    },
    {
      id: '3',
      name: 'Baseline Test',
      status: 'failed',
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      totalTests: 15,
      passedTests: 8,
      failedTests: 7,
      averageScore: 0.52,
      duration: 75000,
    },
  ];
}

function getMockResults(): TestResult[] {
  return [
    {
      testCaseId: '1',
      testCaseName: 'Simple Question Answering',
      passed: true,
      score: 0.95,
      duration: 1200,
      metrics: [
        { name: 'exact_match', score: 1.0, threshold: 0.8, passed: true },
        { name: 'semantic_similarity', score: 0.9, threshold: 0.7, passed: true },
      ],
    },
    {
      testCaseId: '2',
      testCaseName: 'Multi-step Reasoning',
      passed: true,
      score: 0.82,
      duration: 3500,
      metrics: [
        { name: 'contains', score: 1.0, threshold: 0.8, passed: true },
        { name: 'llm_judge', score: 0.85, threshold: 0.7, passed: true },
      ],
    },
    {
      testCaseId: '3',
      testCaseName: 'Code Generation',
      passed: false,
      score: 0.45,
      duration: 5200,
      error: 'Output did not compile',
      metrics: [
        { name: 'syntax_valid', score: 0.0, threshold: 0.8, passed: false },
        { name: 'semantic_similarity', score: 0.65, threshold: 0.7, passed: false },
      ],
    },
    {
      testCaseId: '4',
      testCaseName: 'Summarization Quality',
      passed: true,
      score: 0.88,
      duration: 2800,
      metrics: [
        { name: 'rouge', score: 0.85, threshold: 0.6, passed: true },
        { name: 'llm_judge', score: 0.9, threshold: 0.7, passed: true },
      ],
    },
  ];
}

function getMockTestCases(): TestCase[] {
  return [
    {
      id: '1',
      name: 'Simple Question Answering',
      input: 'What is the capital of France?',
      expectedOutput: 'Paris',
      category: 'factual',
    },
    {
      id: '2',
      name: 'Multi-step Reasoning',
      input: 'If John has 5 apples and gives 2 to Mary, how many does he have?',
      expectedOutput: '3',
      category: 'reasoning',
    },
    {
      id: '3',
      name: 'Code Generation',
      input: 'Write a function to calculate fibonacci numbers in Python',
      expectedOutput: 'def fibonacci(n):...',
      category: 'code',
    },
    {
      id: '4',
      name: 'Summarization Quality',
      input: 'Summarize the following article about climate change...',
      expectedOutput: 'Climate change summary...',
      category: 'summarization',
    },
  ];
}

export default EvaluationDashboard;

