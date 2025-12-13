/**
 * @file HumanInteractionDashboard.tsx
 * @description Dashboard for Human-in-the-Loop (HITL) interactions.
 * Shows pending approvals, clarifications, escalations, and feedback history.
 *
 * @module AgentOS-Workbench/HITL
 */

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Edit3,
  MessageSquare,
  Clock,
  User,
  Shield,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Bell,
  History,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';

// Types matching AgentOS HITL module
interface PendingApproval {
  actionId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  agentId: string;
  context: Record<string, unknown>;
  reversible: boolean;
  requestedAt: Date;
}

interface PendingClarification {
  requestId: string;
  question: string;
  context: string;
  agentId: string;
  options?: { optionId: string; label: string; description?: string }[];
  allowFreeform: boolean;
  requestedAt: Date;
}

interface PendingEscalation {
  escalationId: string;
  reason: string;
  explanation: string;
  agentId: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
  escalatedAt: Date;
}

interface FeedbackEntry {
  feedbackId: string;
  agentId: string;
  feedbackType: 'correction' | 'praise' | 'guidance' | 'preference' | 'complaint';
  content: string;
  importance: number;
  providedAt: Date;
}

// Mock data
const mockApprovals: PendingApproval[] = [
  {
    actionId: 'approval-1',
    description: 'Send newsletter to 5,000 subscribers',
    severity: 'high',
    category: 'communication',
    agentId: 'marketing-agent',
    context: { recipientCount: 5000, template: 'monthly-newsletter' },
    reversible: false,
    requestedAt: new Date(Date.now() - 60000),
  },
  {
    actionId: 'approval-2',
    description: 'Update pricing for 50 products',
    severity: 'medium',
    category: 'data_modification',
    agentId: 'pricing-agent',
    context: { productCount: 50, avgChange: '+5%' },
    reversible: true,
    requestedAt: new Date(Date.now() - 180000),
  },
];

const mockClarifications: PendingClarification[] = [
  {
    requestId: 'clarify-1',
    question: 'Which output format do you prefer for the quarterly report?',
    context: 'Generating Q4 2024 financial report',
    agentId: 'report-agent',
    options: [
      { optionId: 'pdf', label: 'PDF Document', description: 'Portable format for sharing' },
      { optionId: 'excel', label: 'Excel Spreadsheet', description: 'Editable with formulas' },
      { optionId: 'slides', label: 'Presentation', description: 'For executive briefing' },
    ],
    allowFreeform: true,
    requestedAt: new Date(Date.now() - 120000),
  },
];

const mockEscalations: PendingEscalation[] = [
  {
    escalationId: 'esc-1',
    reason: 'low_confidence',
    explanation: 'Multiple conflicting data sources found. Unable to determine authoritative information.',
    agentId: 'research-agent',
    urgency: 'medium',
    recommendations: ['Manual source verification', 'Contact domain expert', 'Use most recent source'],
    escalatedAt: new Date(Date.now() - 300000),
  },
];

const mockFeedback: FeedbackEntry[] = [
  {
    feedbackId: 'fb-1',
    agentId: 'writer-agent',
    feedbackType: 'correction',
    content: 'The tone was too formal for this audience. Use more casual language.',
    importance: 4,
    providedAt: new Date(Date.now() - 86400000),
  },
  {
    feedbackId: 'fb-2',
    agentId: 'analyst-agent',
    feedbackType: 'praise',
    content: 'Excellent insight on market trends. Keep up the good analysis.',
    importance: 3,
    providedAt: new Date(Date.now() - 172800000),
  },
];

/**
 * Get severity badge color
 */
function getSeverityVariant(severity: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (severity) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    default:
      return 'outline';
  }
}

/**
 * Get urgency icon
 */
function getUrgencyIcon(urgency: string) {
  switch (urgency) {
    case 'critical':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'high':
      return <Bell className="w-4 h-4 text-orange-500" />;
    case 'medium':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

/**
 * ApprovalCard - Card for a pending approval request
 */
function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: PendingApproval;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Shield className="w-5 h-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{approval.description}</h4>
            <Badge variant={getSeverityVariant(approval.severity)}>
              {approval.severity}
            </Badge>
            {approval.category && (
              <Badge variant="outline">{approval.category}</Badge>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-2">
            <User className="w-3 h-3 inline mr-1" />
            {approval.agentId} • {new Date(approval.requestedAt).toLocaleTimeString()}
            {!approval.reversible && (
              <span className="ml-2 text-red-500">• Irreversible</span>
            )}
          </p>

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-500 hover:underline flex items-center gap-1"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            View context
          </button>

          {expanded && (
            <pre className="mt-2 p-2 bg-[var(--color-bg-secondary)] rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(approval.context, null, 2)}
            </pre>
          )}

          {showRejectForm && (
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => onReject(approval.actionId, rejectReason)}>
                  Confirm Reject
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowRejectForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-600 hover:bg-green-50"
            onClick={() => onApprove(approval.actionId)}
          >
            <CheckCircle className="w-4 h-4 mr-1" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-600 hover:bg-red-50"
            onClick={() => setShowRejectForm(true)}
          >
            <XCircle className="w-4 h-4 mr-1" /> Reject
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * ClarificationCard - Card for a pending clarification request
 */
function ClarificationCard({
  clarification,
  onSubmit,
}: {
  clarification: PendingClarification;
  onSubmit: (id: string, response: { optionId?: string; freeform?: string }) => void;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeformResponse, setFreeformResponse] = useState('');

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <HelpCircle className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium mb-1">{clarification.question}</h4>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            <User className="w-3 h-3 inline mr-1" />
            {clarification.agentId} • Context: {clarification.context}
          </p>

          {clarification.options && (
            <div className="space-y-2 mb-3">
              {clarification.options.map((opt) => (
                <label
                  key={opt.optionId}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedOption === opt.optionId
                      ? 'border-blue-500 bg-blue-500/5'
                      : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  <input
                    type="radio"
                    name={`clarify-${clarification.requestId}`}
                    checked={selectedOption === opt.optionId}
                    onChange={() => setSelectedOption(opt.optionId)}
                    className="accent-blue-500"
                  />
                  <div>
                    <p className="font-medium">{opt.label}</p>
                    {opt.description && (
                      <p className="text-sm text-[var(--color-text-muted)]">{opt.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {clarification.allowFreeform && (
            <Input
              placeholder="Or type your own response..."
              value={freeformResponse}
              onChange={(e) => setFreeformResponse(e.target.value)}
              className="mb-3"
            />
          )}

          <Button
            size="sm"
            onClick={() =>
              onSubmit(clarification.requestId, {
                optionId: selectedOption || undefined,
                freeform: freeformResponse || undefined,
              })
            }
            disabled={!selectedOption && !freeformResponse}
          >
            <MessageSquare className="w-4 h-4 mr-1" /> Submit Response
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * EscalationCard - Card for a pending escalation
 */
function EscalationCard({
  escalation,
  onResolve,
}: {
  escalation: PendingEscalation;
  onResolve: (id: string, decision: string) => void;
}) {
  return (
    <Card className="p-4 border-l-4 border-l-orange-500">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">Escalation: {escalation.reason.replace('_', ' ')}</h4>
            {getUrgencyIcon(escalation.urgency)}
            <Badge variant={getSeverityVariant(escalation.urgency)}>
              {escalation.urgency}
            </Badge>
          </div>
          <p className="text-sm mb-2">{escalation.explanation}</p>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            <User className="w-3 h-3 inline mr-1" />
            {escalation.agentId} • {new Date(escalation.escalatedAt).toLocaleTimeString()}
          </p>

          {escalation.recommendations && (
            <div className="mb-3">
              <p className="text-sm font-medium mb-1">Agent recommendations:</p>
              <ul className="list-disc list-inside text-sm text-[var(--color-text-muted)]">
                {escalation.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={() => onResolve(escalation.escalationId, 'human_takeover')}>
              <User className="w-4 h-4 mr-1" /> Take Over
            </Button>
            <Button size="sm" variant="outline" onClick={() => onResolve(escalation.escalationId, 'agent_continue')}>
              Let Agent Continue
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600"
              onClick={() => onResolve(escalation.escalationId, 'abort')}
            >
              Abort Task
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * FeedbackHistory - Shows recent feedback entries
 */
function FeedbackHistory({ feedback }: { feedback: FeedbackEntry[] }) {
  const getTypeIcon = (type: FeedbackEntry['feedbackType']) => {
    switch (type) {
      case 'praise':
        return <ThumbsUp className="w-4 h-4 text-green-500" />;
      case 'correction':
      case 'complaint':
        return <ThumbsDown className="w-4 h-4 text-red-500" />;
      default:
        return <Edit3 className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-3">
      {feedback.map((fb) => (
        <div key={fb.feedbackId} className="flex items-start gap-3 p-3 bg-[var(--color-bg-secondary)] rounded-lg">
          {getTypeIcon(fb.feedbackType)}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{fb.agentId}</span>
              <Badge variant="outline" className="text-xs">
                {fb.feedbackType}
              </Badge>
              <span className="text-xs text-[var(--color-text-muted)]">
                {new Date(fb.providedAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm">{fb.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * HumanInteractionDashboard - Main dashboard component
 */
export function HumanInteractionDashboard() {
  const [approvals, setApprovals] = useState<PendingApproval[]>(mockApprovals);
  const [clarifications, setClarifications] = useState<PendingClarification[]>(mockClarifications);
  const [escalations, setEscalations] = useState<PendingEscalation[]>(mockEscalations);
  const [feedback] = useState<FeedbackEntry[]>(mockFeedback);
  const [activeTab, setActiveTab] = useState<'pending' | 'feedback'>('pending');

  const pendingCount = approvals.length + clarifications.length + escalations.length;

  const handleApprove = (actionId: string) => {
    setApprovals((prev) => prev.filter((a) => a.actionId !== actionId));
    // In real implementation, call API
  };

  const handleReject = (actionId: string, _reason: string) => {
    setApprovals((prev) => prev.filter((a) => a.actionId !== actionId));
    // In real implementation, call API with _reason
  };

  const handleClarify = (requestId: string, _response: { optionId?: string; freeform?: string }) => {
    setClarifications((prev) => prev.filter((c) => c.requestId !== requestId));
    // In real implementation, call API with _response
  };

  const handleEscalationResolve = (escalationId: string, _decision: string) => {
    setEscalations((prev) => prev.filter((e) => e.escalationId !== escalationId));
    // In real implementation, call API with _decision
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Human-in-the-Loop</h1>
          <p className="text-[var(--color-text-muted)]">
            Review agent requests and provide guidance
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {pendingCount} Pending
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border)]">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'pending'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Bell className="w-4 h-4 inline mr-2" />
          Pending Requests
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'feedback'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <History className="w-4 h-4 inline mr-2" />
          Feedback History
        </button>
      </div>

      {/* Content */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          {/* Escalations (highest priority) */}
          {escalations.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Escalations ({escalations.length})
              </h2>
              <div className="space-y-3">
                {escalations.map((esc) => (
                  <EscalationCard key={esc.escalationId} escalation={esc} onResolve={handleEscalationResolve} />
                ))}
              </div>
            </section>
          )}

          {/* Approvals */}
          {approvals.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                Pending Approvals ({approvals.length})
              </h2>
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <ApprovalCard
                    key={approval.actionId}
                    approval={approval}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Clarifications */}
          {clarifications.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-500" />
                Clarifications Needed ({clarifications.length})
              </h2>
              <div className="space-y-3">
                {clarifications.map((clarify) => (
                  <ClarificationCard key={clarify.requestId} clarification={clarify} onSubmit={handleClarify} />
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {pendingCount === 0 && (
            <Card className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h3 className="font-medium mb-2">All caught up!</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                No pending requests from agents. They are working autonomously.
              </p>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'feedback' && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Feedback</h2>
          {feedback.length > 0 ? (
            <FeedbackHistory feedback={feedback} />
          ) : (
            <Card className="p-8 text-center">
              <History className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
              <h3 className="font-medium mb-2">No feedback yet</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Feedback you provide to agents will appear here.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}



