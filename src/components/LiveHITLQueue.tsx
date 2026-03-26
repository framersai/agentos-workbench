/**
 * @file LiveHITLQueue.tsx
 * @description Real-time Human-in-the-Loop (HITL) approval queue.
 *
 * Approval flow:
 * ```
 *   Agent requests action
 *     -> backend enqueues PendingApprovalItem
 *       -> frontend polls GET /api/agency/approvals every 5 s (via hitlStore)
 *         -> human reviews in this panel
 *           -> Approve / Reject / Modify
 *             -> POST /api/agency/approvals/:id/decide
 *               -> item removed from pending, added to local history
 * ```
 *
 * Tabs:
 *   **Pending**  -- items awaiting a human decision, colour-coded by severity
 *   (critical=rose, high=amber, medium=sky, low=muted).
 *   **History**  -- local log of decisions made in this browser session
 *   (capped at 50 entries in {@link useHitlStore}).
 *
 * Each pending card provides:
 *   - Type badge, agent ID, action label, description, severity badge
 *   - Expandable context payload (raw JSON)
 *   - "Irreversible" warning when `reversible === false`
 *   - Approve / Reject buttons
 *   - "Modify" toggle for approve-with-modifications via textarea
 *
 * Polling starts on mount via {@link useHitlStore.startPolling} and stops
 * on unmount via {@link useHitlStore.stopPolling}.
 */

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Shield,
  AlertTriangle,
  History,
  Bell,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  User,
  Edit3,
} from 'lucide-react';
import {
  useHitlStore,
  type PendingApprovalItem,
  type ApprovalHistoryItem,
} from '@/state/hitlStore';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

// ---------------------------------------------------------------------------
// Sub-tab
// ---------------------------------------------------------------------------

type HitlTab = 'pending' | 'history';

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_RING: Record<string, string> = {
  critical: 'border-rose-500/60 bg-rose-500/10',
  high: 'border-amber-500/50 bg-amber-500/10',
  medium: 'theme-border theme-bg-primary',
  low: 'theme-border theme-bg-primary opacity-80',
};

const SEVERITY_TEXT: Record<string, string> = {
  critical: 'text-rose-400',
  high: 'text-amber-400',
  medium: 'text-sky-400',
  low: 'theme-text-muted',
};

function SeverityBadge({ severity }: { severity: string }) {
  const textClass = SEVERITY_TEXT[severity] ?? 'theme-text-secondary';
  return (
    <span
      className={`rounded-full border border-current/30 bg-current/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ${textClass}`}
    >
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pending approval card
// ---------------------------------------------------------------------------

interface PendingCardProps {
  item: PendingApprovalItem;
  onApprove: (id: string, modification?: string) => void;
  onReject: (id: string) => void;
}

function PendingCard({ item, onApprove, onReject }: PendingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [modification, setModification] = useState('');

  const ringClass = SEVERITY_RING[item.severity] ?? 'theme-border theme-bg-primary';

  return (
    <div className={`rounded-lg border px-3 py-2.5 transition-colors ${ringClass}`}>
      {/* Header row */}
      <div className="flex items-start gap-2">
        <Shield size={14} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold theme-text-primary">{item.description}</span>
            <SeverityBadge severity={item.severity} />
            {item.type && (
              <span className="rounded-full border theme-border px-1.5 py-px text-[9px] theme-text-muted uppercase tracking-wide">
                {item.type}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] theme-text-secondary">
            <span className="flex items-center gap-1">
              <User size={9} aria-hidden="true" />
              {item.agentId}
            </span>
            <span>{new Date(item.requestedAt).toLocaleTimeString()}</span>
            {!item.reversible && (
              <span className="text-rose-400">Irreversible</span>
            )}
          </p>
          <p className="mt-0.5 font-mono text-[10px] theme-text-muted">{item.action}</p>
        </div>
      </div>

      {/* Context toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? 'Hide context payload.' : 'Show context payload for this approval request.'}
        className="mt-1.5 flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        Context
      </button>
      {expanded && (
        <pre className="mt-1 overflow-auto rounded-lg border theme-border theme-bg-primary px-2 py-1.5 font-mono text-[10px] theme-text-secondary max-h-28">
          {JSON.stringify(item.context, null, 2)}
        </pre>
      )}

      {/* Modification textarea */}
      {showModify && (
        <div className="mt-2 space-y-1.5">
          <textarea
            value={modification}
            onChange={(e) => setModification(e.target.value)}
            rows={2}
            placeholder="Describe any modifications to approve with…"
            title="Optional instructions attached to the approval decision."
            className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
          />
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onApprove(item.id, modification || undefined)}
          title="Approve this agent-requested action."
          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <CheckCircle2 size={10} aria-hidden="true" /> Approve
        </button>
        <button
          type="button"
          onClick={() => onReject(item.id)}
          title="Reject this agent-requested action."
          className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-400 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <XCircle size={10} aria-hidden="true" /> Reject
        </button>
        <button
          type="button"
          onClick={() => setShowModify((v) => !v)}
          title="Approve with optional modifications."
          className="inline-flex items-center gap-1 rounded-full border theme-border px-2.5 py-1 text-[10px] theme-text-secondary transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Edit3 size={10} aria-hidden="true" /> Modify
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History entry
// ---------------------------------------------------------------------------

function HistoryRow({ item }: { item: ApprovalHistoryItem }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border theme-border theme-bg-primary px-3 py-2">
      {item.decision === 'approved' ? (
        <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
      ) : (
        <XCircle size={13} className="mt-0.5 shrink-0 text-rose-400" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs theme-text-primary">{item.description}</p>
        <p className="mt-0.5 flex flex-wrap gap-2 text-[10px] theme-text-secondary">
          <span className="flex items-center gap-1">
            <User size={9} /> {item.agentId}
          </span>
          <span
            className={
              item.decision === 'approved' ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'
            }
          >
            {item.decision}
          </span>
          <span>{new Date(item.decidedAt).toLocaleTimeString()}</span>
        </p>
        {item.modification && (
          <p className="mt-0.5 text-[10px] theme-text-muted italic">"{item.modification}"</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * LiveHITLQueue — real-time human-in-the-loop approval queue wired to the
 * backend `/api/agency/approvals` endpoint via {@link useHitlStore}.
 */
export function LiveHITLQueue() {
  const pending = useHitlStore((s) => s.pending);
  const history = useHitlStore((s) => s.history);
  const loading = useHitlStore((s) => s.loading);
  const error = useHitlStore((s) => s.error);
  const fetchPending = useHitlStore((s) => s.fetchPending);
  const startPolling = useHitlStore((s) => s.startPolling);
  const stopPolling = useHitlStore((s) => s.stopPolling);
  const submitDecision = useHitlStore((s) => s.submitDecision);

  const [activeTab, setActiveTab] = useState<HitlTab>('pending');

  // Start polling on mount, stop on unmount
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const handleApprove = (id: string, modification?: string) => {
    void submitDecision(id, 'approved', modification);
  };

  const handleReject = (id: string) => {
    void submitDecision(id, 'rejected');
  };

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Agency</p>
            <h3 className="text-sm font-semibold theme-text-primary">HITL Queue</h3>
          </div>
          <HelpTooltip label="Explain HITL queue panel" side="bottom">
            Human-in-the-Loop approvals fetched live from the backend. Approve, reject, or modify
            agent-requested actions. Decisions are logged in the History tab.
          </HelpTooltip>
        </div>

        <div className="flex items-center gap-1.5">
          {pending.length > 0 && (
            <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-1.5 py-px text-[9px] font-semibold text-rose-400">
              {pending.length} pending
            </span>
          )}
          <button
            type="button"
            onClick={() => void fetchPending()}
            disabled={loading}
            title="Manually refresh the pending approvals list from the backend."
            className="inline-flex items-center gap-1 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[10px] theme-text-secondary transition hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RefreshCw size={9} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-400">
          <AlertTriangle size={10} className="mr-1 inline" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="mb-3 flex gap-0.5 overflow-x-auto rounded-lg border theme-border theme-bg-primary p-0.5">
        {([
          { key: 'pending' as HitlTab, label: 'Pending', Icon: Bell },
          { key: 'history' as HitlTab, label: 'History', Icon: History },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            title={`Switch to ${label} tab.`}
            className={[
              'flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              activeTab === key
                ? 'bg-sky-500 text-white'
                : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5',
            ].join(' ')}
          >
            <Icon size={9} aria-hidden="true" />
            {label}
            {key === 'pending' && pending.length > 0 && (
              <span className="ml-0.5 rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {activeTab === 'pending' && (
        <div className="space-y-2">
          {pending.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <CheckCircle2 size={20} className="text-emerald-400" aria-hidden="true" />
              <p className="text-xs theme-text-secondary">All caught up.</p>
              <p className="text-[10px] theme-text-muted">
                No pending approvals. Agents are running autonomously.
              </p>
            </div>
          ) : (
            pending.map((item) => (
              <PendingCard
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="space-y-1.5">
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <History size={20} className="theme-text-muted" aria-hidden="true" />
              <p className="text-xs theme-text-secondary">No decisions yet this session.</p>
            </div>
          ) : (
            history.map((item) => <HistoryRow key={`${item.id}-${item.decidedAt}`} item={item} />)
          )}
        </div>
      )}
    </section>
  );
}
