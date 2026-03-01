/**
 * @fileoverview Agency History View
 * @description Displays historical agency executions with emergent behavior insights
 */

import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import {
  History,
  Clock,
  DollarSign,
  Users,
  Brain,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import {
  listAgencyExecutions,
  getAgencyExecution,
  type AgencyExecutionRecord,
  type AgencySeatRecord,
} from '../lib/agentosClient';

export const AgencyHistoryView: React.FC<{ userId: string }> = ({ userId }) => {
  const [executions, setExecutions] = useState<AgencyExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgencyId, setExpandedAgencyId] = useState<string | null>(null);
  const [agencyDetails, setAgencyDetails] = useState<
    Map<string, { execution: AgencyExecutionRecord; seats: AgencySeatRecord[] }>
  >(new Map());

  useEffect(() => {
    loadExecutions();
  }, [userId]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const data = await listAgencyExecutions(userId, 20);
      setExecutions(data);
    } catch (error) {
      console.error('Failed to load agency executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (agencyId: string) => {
    if (expandedAgencyId === agencyId) {
      setExpandedAgencyId(null);
      return;
    }

    setExpandedAgencyId(agencyId);
    
    if (!agencyDetails.has(agencyId)) {
      try {
        const details = await getAgencyExecution(agencyId);
        if (details) {
          setAgencyDetails((previous) => {
            const next = new Map(previous);
            next.set(agencyId, details);
            return next;
          });
        }
      } catch (error) {
        console.error(`Failed to load details for agency ${agencyId}:`, error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      case 'running': return 'primary';
      default: return 'secondary';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatCost = (cost?: number) => {
    if (!cost) return '$0.00';
    return `$${cost.toFixed(4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs theme-text-muted">Loading history...</span>
        </div>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <Card className="p-6 text-center">
        <History className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <h3 className="text-sm font-semibold mb-1 theme-text-primary">No Executions</h3>
        <p className="text-xs text-muted-foreground">
          Agency executions will appear here once you start a multi-agent workflow.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold theme-text-primary">Execution History</h2>
        </div>
        <Badge variant="secondary" size="xs">{executions.length} total</Badge>
      </div>

      <div className="space-y-2">
        {executions.map((execution) => {
          const isExpanded = expandedAgencyId === execution.agencyId;
          const details = agencyDetails.get(execution.agencyId);
          let emergentData: { tasksDecomposed?: Array<{ taskId: string; description: string }> } | null =
            null;
          if (typeof execution.emergentMetadata === 'string' && execution.emergentMetadata.trim().length > 0) {
            try {
              emergentData = JSON.parse(execution.emergentMetadata) as {
                tasksDecomposed?: Array<{ taskId: string; description: string }>;
              };
            } catch {
              emergentData = null;
            }
          }

          return (
            <Card key={execution.agencyId} className="overflow-hidden">
              <div
                className="p-3 cursor-pointer hover:bg-accent/5 transition-colors"
                onClick={() => toggleExpand(execution.agencyId)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1.5">
                      {isExpanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                      <h3 className="font-semibold text-sm truncate theme-text-primary">
                        {execution.goal || execution.agencyId}
                      </h3>
                      <Badge variant={getStatusColor(execution.status)} size="xs">
                        <span className="capitalize">{execution.status}</span>
                      </Badge>
                      {emergentData && (
                        <Badge variant="primary" size="xs">
                          <Zap className="w-2.5 h-2.5 mr-1" />
                          Emergent
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-[10px] theme-text-secondary">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatDuration(execution.durationMs)}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <DollarSign className="w-2.5 h-2.5" />
                        <span>{formatCost(execution.totalCostUsd)}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Users className="w-2.5 h-2.5" />
                        <span>{details?.seats.length ?? '...'} seats</span>
                      </span>
                      {emergentData && (
                        <span className="flex items-center space-x-1">
                          <Brain className="w-2.5 h-2.5" />
                          <span>{emergentData.tasksDecomposed?.length ?? 0} tasks</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] theme-text-muted whitespace-nowrap ml-2">
                    {new Date(execution.startedAt).toLocaleTimeString()}
                  </div>
                </div>

                {isExpanded && details && (
                  <div className="mt-3 pt-3 border-t theme-border space-y-3" onClick={(e) => e.stopPropagation()}>
                    {/* Seats */}
                    <div>
                      <h4 className="font-medium text-xs mb-1.5 theme-text-secondary uppercase tracking-wider">Agent Seats</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {details.seats.map((seat) => (
                          <div key={seat.id} className="p-2 border rounded-md space-y-1 bg-secondary/20">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-xs theme-text-primary">{seat.roleId}</span>
                              <Badge variant={getStatusColor(seat.status)} size="xs">
                                {seat.status}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[10px] theme-text-muted">
                              <span>Persona: {seat.personaId}</span>
                              {seat.usageCostUsd && <span>{formatCost(seat.usageCostUsd)}</span>}
                            </div>
                            {seat.output && (
                              <div className="text-[10px] bg-secondary p-1.5 rounded max-h-16 overflow-y-auto theme-text-secondary font-mono">
                                {seat.output.substring(0, 150)}
                                {seat.output.length > 150 && '...'}
                              </div>
                            )}
                            {seat.error && (
                              <div className="text-[10px] text-destructive bg-destructive/10 p-1.5 rounded">
                                {seat.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Emergent Metadata */}
                    {emergentData && (
                      <div>
                        <h4 className="font-medium text-xs mb-1.5 flex items-center space-x-1 theme-text-secondary uppercase tracking-wider">
                          <Zap className="w-3 h-3 text-primary" />
                          <span>Emergent Analysis</span>
                        </h4>
                        <div className="space-y-2 text-[10px] theme-text-secondary">
                          {emergentData.tasksDecomposed && emergentData.tasksDecomposed.length > 0 && (
                            <div>
                              <div className="font-medium mb-1">Tasks:</div>
                              <ul className="list-disc list-inside space-y-0.5 pl-1">
                                {emergentData.tasksDecomposed.map((task: { taskId: string; description: string }) => (
                                  <li key={task.taskId}>
                                    {task.description}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Consolidated Output */}
                    {execution.consolidatedOutput && (
                      <div>
                        <h4 className="font-medium text-xs mb-1.5 theme-text-secondary uppercase tracking-wider">Output</h4>
                        <div className="text-[10px] bg-secondary p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap theme-text-primary font-mono">
                          {execution.consolidatedOutput}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
