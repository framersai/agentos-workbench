/**
 * VoiceCallMonitor — live call monitoring panel.
 *
 * Sub-tabs:
 *   Live      — real-time transcript with speaker labels, barge-in indicator,
 *               call-state badge, audio metrics, and provider resolution chain.
 *   Controls  — mute / end-call / record buttons.
 *   History   — past calls table with transcript preview and playback placeholder.
 *
 * All state lives in {@link useVoiceCallStore}.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Circle,
  RadioReceiver,
  Cpu,
  Volume2,
  Clock,
  ChevronRight,
  RefreshCw,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import {
  useVoiceCallStore,
  type VoiceCall,
  type CallTranscriptLine,
} from '@/state/voiceCallStore';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

// ---------------------------------------------------------------------------
// Sub-tab types
// ---------------------------------------------------------------------------

type MonitorSubTab = 'live' | 'controls' | 'history';

interface SubTabDef { key: MonitorSubTab; label: string }

const SUB_TABS: SubTabDef[] = [
  { key: 'live',     label: 'Live'     },
  { key: 'controls', label: 'Controls' },
  { key: 'history',  label: 'History'  },
];

// ---------------------------------------------------------------------------
// Call state badge
// ---------------------------------------------------------------------------

const STATE_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  listening:  { bg: 'bg-sky-500/15 border border-sky-500/40',      text: 'text-sky-300',     dot: 'bg-sky-400 animate-pulse' },
  processing: { bg: 'bg-amber-500/15 border border-amber-500/40',  text: 'text-amber-300',   dot: 'bg-amber-400 animate-spin' },
  speaking:   { bg: 'bg-emerald-500/15 border border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  idle:       { bg: 'theme-border theme-bg-primary',               text: 'theme-text-muted',  dot: 'bg-gray-500' },
};

/**
 * Large colored state badge shown at the top of the Live sub-tab.
 */
function CallStateBadge({ state }: { state: string }) {
  const s = STATE_BADGE[state] ?? STATE_BADGE.idle;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ${s.bg} ${s.text}`}>
      <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} aria-hidden="true" />
      {state}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barge-in flash indicator
// ---------------------------------------------------------------------------

interface BargeInFlashProps {
  visible: boolean;
  interruptedText: string;
}

/**
 * Flashes an orange badge when a barge-in interruption is detected.
 */
function BargeInFlash({ visible, interruptedText }: BargeInFlashProps) {
  if (!visible) return null;
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/15 px-3 py-1.5 text-[10px] text-orange-300 animate-pulse"
      role="alert"
      aria-live="polite"
    >
      <RadioReceiver size={11} aria-hidden="true" />
      <span className="font-semibold uppercase tracking-wide">Barge-in</span>
      {interruptedText && (
        <span className="truncate opacity-80">Interrupted: &ldquo;{interruptedText}&rdquo;</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio metrics row
// ---------------------------------------------------------------------------

interface MetricBadgeProps { label: string; value: string; Icon: LucideIcon }

function MetricBadge({ label, value, Icon }: MetricBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border theme-border theme-bg-primary px-2.5 py-1.5">
      <Icon size={10} className="shrink-0 theme-text-muted" aria-hidden="true" />
      <span className="text-[10px] theme-text-muted">{label}</span>
      <span className="font-mono text-[10px] font-semibold theme-text-primary">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcript list
// ---------------------------------------------------------------------------

/**
 * Scrollable list of transcript lines with speaker labels and timestamps.
 */
function TranscriptView({ lines, loading }: { lines: CallTranscriptLine[]; loading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[10px] theme-text-muted">
        <RefreshCw size={12} className="animate-spin mr-2" aria-hidden="true" />
        Loading transcript…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-6 text-center">
        <Mic size={18} className="theme-text-muted" aria-hidden="true" />
        <p className="text-[10px] theme-text-muted">No transcript yet. Select a call or wait for a live session.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5 overflow-y-auto max-h-64 pr-1" aria-label="Call transcript">
      {lines.map((line, idx) => (
        // eslint-disable-next-line react/no-array-index-key
        <li key={idx} className={`flex gap-2.5 text-[10px] ${line.bargedIn ? 'opacity-60' : ''}`}>
          <span
            className={`shrink-0 w-12 font-semibold capitalize ${
              line.speaker === 'Agent' ? 'text-sky-400' : 'theme-text-secondary'
            }`}
          >
            {line.speaker}
          </span>
          <div className="flex-1 min-w-0">
            <span className={`theme-text-primary ${line.bargedIn ? 'line-through opacity-60' : ''}`}>
              {line.text}
            </span>
            {line.bargedIn && (
              <span className="ml-1.5 rounded-sm bg-orange-500/20 px-1 text-orange-300 text-[9px]">
                barged-in
              </span>
            )}
          </div>
          <time
            className="shrink-0 font-mono text-[9px] theme-text-muted"
            dateTime={line.timestamp}
          >
            {new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </time>
        </li>
      ))}
      <div ref={bottomRef} />
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Provider chain display
// ---------------------------------------------------------------------------

function ProviderChain({ selected, chain }: { selected: string; chain: string[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Provider Resolution</p>
      <div className="flex flex-wrap items-center gap-1">
        {chain.map((p, idx) => (
          <span key={p} className="flex items-center gap-1">
            <span
              className={[
                'rounded-md border px-2 py-0.5 text-[10px] font-medium',
                p === selected
                  ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                  : 'theme-border theme-bg-primary theme-text-muted',
              ].join(' ')}
            >
              {p}
            </span>
            {idx < chain.length - 1 && (
              <ChevronRight size={9} className="theme-text-muted" aria-hidden="true" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Call history row
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface CallHistoryRowProps {
  call: VoiceCall;
  selected: boolean;
  onSelect: () => void;
}

function CallHistoryRow({ call, selected, onSelect }: CallHistoryRowProps) {
  return (
    <li
      className={[
        'rounded-lg border px-3 py-2 transition-colors cursor-pointer',
        selected ? 'border-sky-500/60 bg-sky-500/10' : 'theme-border theme-bg-primary hover:bg-white/5',
      ].join(' ')}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      tabIndex={0}
      role="option"
      aria-selected={selected}
    >
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <div className="min-w-0">
          <p className="font-medium theme-text-primary truncate">{call.callerId}</p>
          <p className="theme-text-muted truncate mt-0.5">{call.transcriptPreview}</p>
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          <p className="font-mono theme-text-secondary">
            {call.durationSeconds != null ? formatDuration(call.durationSeconds) : 'live'}
          </p>
          <p className="theme-text-muted">{call.turnCount} turns</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[9px] theme-text-muted">
        <span>{new Date(call.startedAt).toLocaleString()}</span>
        {call.hasRecording && (
          <span className="rounded-sm border border-sky-500/30 bg-sky-500/10 px-1 py-px text-sky-400">
            REC
          </span>
        )}
        <span className="font-mono">{call.sttProvider}</span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Mock live call state (simulated when no real call is active)
// ---------------------------------------------------------------------------

const LIVE_STATES = ['listening', 'processing', 'speaking', 'listening', 'idle'] as const;

function useLiveCallSimulation() {
  const [stateIdx, setStateIdx] = useState(0);
  const triggerBargeIn = useVoiceCallStore((s) => s.triggerBargeIn);
  const setAudioMetrics = useVoiceCallStore((s) => s.setAudioMetrics);

  useEffect(() => {
    const interval = setInterval(() => {
      setStateIdx((i) => {
        const next = (i + 1) % LIVE_STATES.length;
        if (LIVE_STATES[next] === 'speaking' && Math.random() > 0.6) {
          triggerBargeIn('Let me finish — I wanted to say…');
        }
        return next;
      });
      setAudioMetrics({
        latencyMs: 260 + Math.round(Math.random() * 200),
        vadConfidence: 0.7 + Math.random() * 0.29,
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [triggerBargeIn, setAudioMetrics]);

  return LIVE_STATES[stateIdx];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * VoiceCallMonitor — real-time and historical call monitoring panel.
 *
 * Extends VoicePipelinePanel with live transcript display, barge-in detection,
 * audio metrics, provider chain visualization, call controls, and call history.
 */
export function VoiceCallMonitor() {
  const calls            = useVoiceCallStore((s) => s.calls);
  const transcript       = useVoiceCallStore((s) => s.activeCallTranscript);
  const selectedCallId   = useVoiceCallStore((s) => s.selectedCallId);
  const bargeInFlash     = useVoiceCallStore((s) => s.bargeInFlash);
  const bargeInText      = useVoiceCallStore((s) => s.bargeInText);
  const audioMetrics     = useVoiceCallStore((s) => s.audioMetrics);
  const loading          = useVoiceCallStore((s) => s.loading);
  const transcriptLoading = useVoiceCallStore((s) => s.transcriptLoading);
  const fetchCalls       = useVoiceCallStore((s) => s.fetchCalls);
  const fetchTranscript  = useVoiceCallStore((s) => s.fetchTranscript);

  const [activeSubTab, setActiveSubTab] = useState<MonitorSubTab>('live');
  const [muted, setMuted]               = useState(false);
  const [recording, setRecording]       = useState(false);

  // Simulated live call state (rotates automatically as a demo).
  const liveState = useLiveCallSimulation();

  useEffect(() => {
    void fetchCalls();
  }, [fetchCalls]);

  // Auto-load the first call's transcript on mount for the History tab preview.
  useEffect(() => {
    if (calls.length > 0 && !selectedCallId) {
      void fetchTranscript(calls[0].id);
    }
  }, [calls, selectedCallId, fetchTranscript]);

  const selectedCall = calls.find((c) => c.id === selectedCallId) ?? calls[0];

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Voice</p>
            <h3 className="text-sm font-semibold theme-text-primary">Call Monitor</h3>
          </div>
          <HelpTooltip label="Explain call monitor" side="bottom">
            Live transcript viewer and historical call browser for the AgentOS voice pipeline.
            The Live tab shows a simulated call state when no real session is active.
          </HelpTooltip>
        </div>
        <button
          type="button"
          onClick={() => void fetchCalls()}
          disabled={loading}
          title="Refresh call list"
          className="inline-flex items-center gap-1.5 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2.5 py-1 text-[10px] theme-text-secondary transition hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {/* Sub-tab strip */}
      <div className="mb-4 flex gap-0.5 overflow-x-auto rounded-lg border theme-border theme-bg-primary p-0.5">
        {SUB_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSubTab(key)}
            title={`Open ${label} section`}
            className={[
              'shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              activeSubTab === key
                ? 'bg-sky-500 text-white'
                : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Live tab                                                             */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'live' && (
        <div className="space-y-3">
          {/* Call state badge */}
          <div className="flex flex-wrap items-center gap-3">
            <CallStateBadge state={liveState} />
            <BargeInFlash visible={bargeInFlash} interruptedText={bargeInText} />
          </div>

          {/* Audio metrics row */}
          <div className="flex flex-wrap gap-2">
            <MetricBadge label="Latency"   value={`${audioMetrics.latencyMs} ms`}            Icon={Activity} />
            <MetricBadge label="VAD conf." value={`${Math.round(audioMetrics.vadConfidence * 100)}%`} Icon={Mic}      />
            <MetricBadge label="Endpoint"  value={audioMetrics.endpointMode}                 Icon={Cpu}      />
          </div>

          {/* Provider chain */}
          {selectedCall && (
            <ProviderChain
              selected={selectedCall.sttProvider}
              chain={selectedCall.providerChain}
            />
          )}

          {/* Live transcript */}
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Live Transcript
            </p>
            <TranscriptView lines={transcript} loading={transcriptLoading} />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Controls tab                                                         */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'controls' && (
        <div className="space-y-4">
          <p className="text-[10px] theme-text-secondary">
            Call controls affect the active voice pipeline session.  In demo mode these buttons
            toggle local UI state only.
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Mute */}
            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              className={[
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                muted
                  ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                  : 'theme-border theme-bg-primary theme-text-secondary hover:bg-white/5',
              ].join(' ')}
              title={muted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {muted ? <MicOff size={13} aria-hidden="true" /> : <Mic size={13} aria-hidden="true" />}
              {muted ? 'Unmute' : 'Mute'}
            </button>

            {/* End call */}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-rose-500/60 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              title="End the active call"
            >
              <PhoneOff size={13} aria-hidden="true" />
              End Call
            </button>

            {/* Record */}
            <button
              type="button"
              onClick={() => setRecording((v) => !v)}
              className={[
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                recording
                  ? 'border-red-500/60 bg-red-500/15 text-red-300'
                  : 'theme-border theme-bg-primary theme-text-secondary hover:bg-white/5',
              ].join(' ')}
              title={recording ? 'Stop recording' : 'Start recording'}
            >
              <Circle size={13} className={recording ? 'fill-red-400 text-red-400' : ''} aria-hidden="true" />
              {recording ? 'Stop Recording' : 'Start Recording'}
            </button>
          </div>

          {/* Status labels */}
          <div className="space-y-1 text-[10px] theme-text-muted">
            <p>Microphone: <span className={muted ? 'text-rose-400' : 'text-emerald-400'}>{muted ? 'muted' : 'live'}</span></p>
            <p>Recording: <span className={recording ? 'text-red-400' : 'theme-text-muted'}>{recording ? 'active' : 'off'}</span></p>
            <p>Session state: <span className="text-sky-400">{liveState}</span></p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* History tab                                                          */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'history' && (
        <div className="space-y-3">
          {/* Call list */}
          <ul
            className="space-y-1.5"
            role="listbox"
            aria-label="Past calls"
          >
            {calls.map((call) => (
              <CallHistoryRow
                key={call.id}
                call={call}
                selected={call.id === selectedCallId}
                onSelect={() => void fetchTranscript(call.id)}
              />
            ))}
          </ul>

          {/* Transcript preview for selected call */}
          {selectedCallId && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">
                  Transcript
                </p>
                {selectedCall?.hasRecording && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-px text-[9px] text-sky-400">
                    <Volume2 size={9} aria-hidden="true" />
                    Recording available
                  </span>
                )}
              </div>
              <div className="rounded-lg border theme-border theme-bg-primary p-2.5">
                <TranscriptView lines={transcript} loading={transcriptLoading} />
              </div>

              {/* Call metadata */}
              {selectedCall && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] theme-text-secondary">
                  <div className="flex items-center gap-1">
                    <Clock size={9} className="theme-text-muted" aria-hidden="true" />
                    <span className="theme-text-muted">Started:</span>
                    <span>{new Date(selectedCall.startedAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="theme-text-muted">Duration:</span>{' '}
                    <span>{selectedCall.durationSeconds != null ? formatDuration(selectedCall.durationSeconds) : '—'}</span>
                  </div>
                  <div>
                    <span className="theme-text-muted">STT:</span>{' '}
                    <span className="font-mono">{selectedCall.sttProvider}</span>
                  </div>
                  <div>
                    <span className="theme-text-muted">TTS:</span>{' '}
                    <span className="font-mono">{selectedCall.ttsProvider}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
