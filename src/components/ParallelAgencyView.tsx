import React, { useState, useRef } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';
import { 
  Users, 
  Play, 
  Pause,
  RotateCcw,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader,
  ArrowRight,
  Sparkles,
  Brain,
  MessageSquare,
  Send
} from 'lucide-react';
import { agentosClient } from '../lib/agentosClient';

interface AgentState {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'thinking' | 'executing' | 'complete' | 'error';
  currentTask?: string;
  progress: number;
  messages: Array<{
    type: 'thought' | 'action' | 'result';
    content: string;
    timestamp: Date;
  }>;
  avatar?: string;
  capabilities: string[];
}

interface WorkflowTask {
  id: string;
  name: string;
  executor: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  dependencies: string[];
  result?: unknown;
}

interface WorkflowUpdateEvent {
  type: 'task_start' | 'task_complete' | 'task_error' | 'agent_thinking' | 'agent_action' | 'workflow_complete';
  taskId?: string;
  executor?: string;
  taskName?: string;
  progress?: number;
  agentId?: string;
  thought?: string;
  action?: string;
  error?: string;
}

export const ParallelAgencyView: React.FC = () => {
  const [agents, setAgents] = useState<AgentState[]>([
    {
      id: 'researcher',
      name: 'Research Specialist',
      role: 'Information Gathering',
      status: 'idle',
      progress: 0,
      messages: [],
      capabilities: ['webSearch', 'factCheck', 'researchAggregator'],
      avatar: '🔬'
    },
    {
      id: 'communicator',
      name: 'Communications Manager',
      role: 'Content Distribution',
      status: 'idle',
      progress: 0,
      messages: [],
      capabilities: ['telegramSendMessage', 'telegramSendPhoto'],
      avatar: '📱'
    }
  ]);

  const [workflowTasks, setWorkflowTasks] = useState<WorkflowTask[]>([
    {
      id: 'search-technical',
      name: 'Search Technical Info',
      executor: 'researcher',
      status: 'pending',
      dependencies: []
    },
    {
      id: 'search-news',
      name: 'Search Latest News',
      executor: 'researcher',
      status: 'pending',
      dependencies: []
    },
    {
      id: 'fact-check',
      name: 'Fact Check Claims',
      executor: 'researcher',
      status: 'pending',
      dependencies: ['search-technical', 'search-news']
    },
    {
      id: 'format-report',
      name: 'Format Report',
      executor: 'communicator',
      status: 'pending',
      dependencies: ['fact-check']
    },
    {
      id: 'send-telegram',
      name: 'Send to Telegram',
      executor: 'communicator',
      status: 'pending',
      dependencies: ['format-report']
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startWorkflow = async () => {
    setIsRunning(true);
    setWorkflowProgress(0);
    
    // Reset all tasks
    setWorkflowTasks(tasks => tasks.map(t => ({ ...t, status: 'pending', result: undefined })));
    setAgents(agents => agents.map(a => ({ ...a, status: 'idle', progress: 0, messages: [] })));
    
    // Connect to SSE for real-time updates
    const eventSource = new EventSource('/api/agentos/agency/workflow/stream');
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWorkflowUpdate(data);
    };
    
    // Start the workflow
    await agentosClient.startAgencyWorkflow({
      topic: 'Quantum Computing Breakthroughs',
      telegramChannel: '@test_channel'
    });
  };

  const handleWorkflowUpdate = (update: WorkflowUpdateEvent) => {
    switch (update.type) {
      case 'task_start':
        updateTaskStatus(update.taskId, 'running');
        updateAgentStatus(update.executor, 'executing', update.taskName);
        break;
        
      case 'task_complete':
        updateTaskStatus(update.taskId, 'complete');
        updateAgentProgress(update.executor, update.progress);
        break;
        
      case 'agent_thinking':
        updateAgentStatus(update.agentId, 'thinking');
        addAgentMessage(update.agentId, 'thought', update.thought);
        break;
        
      case 'agent_action':
        addAgentMessage(update.agentId, 'action', update.action);
        break;
        
      case 'workflow_complete':
        setIsRunning(false);
        setWorkflowProgress(100);
        break;
    }
  };

  const updateTaskStatus = (taskId: string, status: WorkflowTask['status']) => {
    setWorkflowTasks(tasks => tasks.map(t => 
      t.id === taskId ? { ...t, status } : t
    ));
  };

  const updateAgentStatus = (agentId: string, status: AgentState['status'], task?: string) => {
    setAgents(agents => agents.map(a => 
      a.id === agentId ? { ...a, status, currentTask: task } : a
    ));
  };

  const updateAgentProgress = (agentId: string, progress: number) => {
    setAgents(agents => agents.map(a => 
      a.id === agentId ? { ...a, progress } : a
    ));
  };

  const addAgentMessage = (agentId: string, type: 'thought' | 'action' | 'result', content: string) => {
    setAgents(agents => agents.map(a => 
      a.id === agentId 
        ? { 
            ...a, 
            messages: [...a.messages, { type, content, timestamp: new Date() }].slice(-5)
          }
        : a
    ));
  };

  const getTaskIcon = (status: WorkflowTask['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-gray-400" />;
      case 'running': return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'complete': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getAgentStatusColor = (status: AgentState['status']) => {
    switch (status) {
      case 'idle': return 'bg-gray-100';
      case 'thinking': return 'bg-yellow-100 animate-pulse';
      case 'executing': return 'bg-blue-100';
      case 'complete': return 'bg-green-100';
      case 'error': return 'bg-red-100';
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Parallel Agency Workflow</h2>
          <Badge variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            Live Demo
          </Badge>
        </div>
        <div className="flex space-x-2">
          {!isRunning ? (
            <Button onClick={startWorkflow} variant="primary">
              <Play className="w-4 h-4 mr-2" />
              Start Workflow
            </Button>
          ) : (
            <Button onClick={() => setIsRunning(false)} variant="secondary">
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          <Button variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Workflow Progress */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">Overall Progress</span>
          <span className="text-sm text-muted-foreground">{workflowProgress}%</span>
        </div>
        <Progress value={workflowProgress} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Agents Panel */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-lg">Active Agents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map(agent => (
              <Card key={agent.id} className={`p-4 space-y-3 ${getAgentStatusColor(agent.status)} transition-all`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{agent.avatar}</span>
                    <div>
                      <h4 className="font-semibold">{agent.name}</h4>
                      <p className="text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                  </div>
                  <Badge variant={agent.status === 'executing' ? 'primary' : 'secondary'} size="sm">
                    {agent.status}
                  </Badge>
                </div>
                
                {agent.currentTask && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Activity className="w-4 h-4" />
                    <span>{agent.currentTask}</span>
                  </div>
                )}
                
                <Progress value={agent.progress} className="h-2" />
                
                {/* Agent Messages */}
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {agent.messages.map((msg, idx) => (
                    <div key={idx} className="text-xs flex items-start space-x-1">
                      {msg.type === 'thought' && <Brain className="w-3 h-3 text-yellow-500 mt-0.5" />}
                      {msg.type === 'action' && <Sparkles className="w-3 h-3 text-blue-500 mt-0.5" />}
                      {msg.type === 'result' && <CheckCircle className="w-3 h-3 text-green-500 mt-0.5" />}
                      <span className="flex-1">{msg.content}</span>
                    </div>
                  ))}
                </div>
                
                {/* Capabilities */}
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.map(cap => (
                    <Badge key={cap} variant="outline" size="xs">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Workflow Tasks Panel */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Workflow Tasks</h3>
          <Card className="p-4">
            <div className="space-y-3">
              {workflowTasks.map((task, idx) => (
                <div key={task.id} className="relative">
                  <div className="flex items-center space-x-3">
                    {getTaskIcon(task.status)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{task.name}</p>
                      <p className="text-xs text-muted-foreground">
                        by {agents.find(a => a.id === task.executor)?.name}
                      </p>
                    </div>
                  </div>
                  
                  {/* Connection Line */}
                  {idx < workflowTasks.length - 1 && (
                    <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gray-200">
                      {task.status === 'complete' && (
                        <div className="absolute inset-0 bg-green-500 animate-flow" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Live Output */}
          <Card className="p-4 space-y-2">
            <h4 className="font-medium flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Live Output</span>
            </h4>
            <div className="text-xs space-y-1 h-48 overflow-y-auto bg-secondary p-2 rounded">
              {isRunning && (
                <>
                  <div className="flex items-center space-x-1">
                    <Send className="w-3 h-3 text-blue-500" />
                    <span>Workflow initiated...</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <ArrowRight className="w-3 h-3 text-green-500" />
                    <span>Parallel execution started</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Activity className="w-3 h-3 text-yellow-500" />
                    <span>Agents coordinating tasks...</span>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
