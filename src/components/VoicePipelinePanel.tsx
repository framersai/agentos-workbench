/**
 * @file VoicePipelinePanel.tsx
 * @description Voice pipeline status and configuration panel.
 *
 * Sub-tabs:
 *   **Providers** -- STT / TTS / telephony provider env-var presence indicators.
 *     Green = configured (env var present), Red = not configured.
 *     Provider catalogs: Deepgram, OpenAI STT, AssemblyAI, Whisper (STT);
 *     ElevenLabs, OpenAI TTS, Cartesia, PlayHT (TTS);
 *     Twilio, Telnyx, Plivo (telephony).
 *
 *   **Config** -- voice pipeline settings:
 *     - Endpointing mode: server-vad | client-vad | manual.
 *     - Barge-in toggle (allow callers to interrupt).
 *     - Diarization toggle (speaker identification).
 *     - Language selector.
 *     - Voice / persona selector.
 *
 *   **Sessions** -- live voice pipeline sessions with state, turn count,
 *     duration, and scrollable transcript.
 *
 * All state is managed via {@link useVoiceStore}.  The panel fetches live
 * status from `GET /api/voice/status` on mount and supports manual refresh.
 */

import { useEffect, useState } from 'react';
import {
  Mic,
  Volume2,
  Phone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { useVoiceStore, type VoiceProvider, type VoiceSession } from '@/state/voiceStore';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

// ---------------------------------------------------------------------------
// Sub-tab navigation
// ---------------------------------------------------------------------------

type VoiceSubTab = 'providers' | 'config' | 'sessions';

interface SubTabDescriptor {
  key: VoiceSubTab;
  label: string;
}

const SUB_TABS: SubTabDescriptor[] = [
  { key: 'providers', label: 'Providers' },
  { key: 'config',    label: 'Config'    },
  { key: 'sessions',  label: 'Sessions'  },
];

// ---------------------------------------------------------------------------
// Provider section helpers
// ---------------------------------------------------------------------------

interface ProviderGroupProps {
  title: string;
  Icon: LucideIcon;
  providers: VoiceProvider[];
}

/**
 * Renders a titled list of providers with green/red env-var status indicators.
 */
function ProviderGroup({ title, Icon, providers }: ProviderGroupProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={12} className="theme-text-muted" aria-hidden="true" />
        <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">{title}</p>
      </div>
      <ul className="space-y-1">
        {providers.map((provider) => (
          <li
            key={provider.id}
            className="flex items-center justify-between rounded-lg border theme-border theme-bg-primary px-3 py-1.5"
          >
            <div className="min-w-0">
              <span className="text-xs font-medium theme-text-primary">{provider.name}</span>
              <p className="mt-0.5 font-mono text-[10px] theme-text-muted">{provider.envVar}</p>
            </div>
            <div className="ml-3 flex shrink-0 items-center gap-1.5">
              {provider.configured ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-400" aria-hidden="true" />
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-emerald-300">
                    configured
                  </span>
                </>
              ) : (
                <>
                  <XCircle size={13} className="text-rose-400" aria-hidden="true" />
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-rose-400">
                    missing
                  </span>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session card
// ---------------------------------------------------------------------------

const SESSION_STATE_COLORS: Record<string, string> = {
  listening:  'text-sky-400',
  processing: 'text-amber-400',
  speaking:   'text-emerald-400',
  idle:       'theme-text-muted',
};

const SESSION_STATE_RING: Record<string, string> = {
  listening:  'border-sky-500/40 bg-sky-500/10',
  processing: 'border-amber-500/40 bg-amber-500/10',
  speaking:   'border-emerald-500/40 bg-emerald-500/10',
  idle:       'theme-border theme-bg-primary',
};

/**
 * Formats an elapsed-seconds number as `m:ss`.
 */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface SessionCardProps {
  session: VoiceSession;
}

/**
 * Collapsible card showing a single active voice session.
 */
function SessionCard({ session }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const stateLabel = session.state || 'idle';
  const stateColor = SESSION_STATE_COLORS[stateLabel] ?? 'theme-text-muted';
  const ringClass  = SESSION_STATE_RING[stateLabel]  ?? 'theme-border theme-bg-primary';

  return (
    <div className={`rounded-lg border px-3 py-2 transition-colors ${ringClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs theme-text-primary">{session.id}</p>
          <div className="mt-0.5 flex items-center gap-3 text-[10px] theme-text-secondary">
            <span className={`font-semibold capitalize ${stateColor}`}>{stateLabel}</span>
            <span>Turns: {session.turns}</span>
            <span>Duration: {formatDuration(session.duration)}</span>
          </div>
        </div>
        {session.transcript.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse transcript' : 'Expand transcript'}
            className="shrink-0 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[10px] theme-text-secondary transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {expanded ? 'Hide' : 'Transcript'}
          </button>
        )}
      </div>

      {expanded && session.transcript.length > 0 && (
        <ul className="mt-2 space-y-1 border-t theme-border pt-2">
          {session.transcript.map((line, idx) => (
            // Using index as key is acceptable here — transcript lines are
            // append-only and the list never reorders.
            // eslint-disable-next-line react/no-array-index-key
            <li key={idx} className="flex gap-2 text-[10px]">
              <span
                className={`shrink-0 w-10 font-semibold capitalize ${
                  line.speaker === 'agent' ? 'text-sky-400' : 'theme-text-secondary'
                }`}
              >
                {line.speaker}
              </span>
              <span className="theme-text-primary">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Voice Pipeline Panel.
 *
 * Renders provider status, pipeline configuration, and active session monitoring
 * for the AgentOS voice stack (Wunderland CLI).  This is a read-write config
 * and monitoring UI; the actual audio pipeline runs externally.
 */
export function VoicePipelinePanel() {
  const providers    = useVoiceStore((s) => s.providers);
  const config       = useVoiceStore((s) => s.config);
  const sessions     = useVoiceStore((s) => s.sessions);
  const loading      = useVoiceStore((s) => s.loading);
  const error        = useVoiceStore((s) => s.error);
  const updateConfig = useVoiceStore((s) => s.updateConfig);
  const fetchStatus  = useVoiceStore((s) => s.fetchStatus);

  const [activeSubTab, setActiveSubTab] = useState<VoiceSubTab>('providers');

  // Fetch provider status on mount.
  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Voice</p>
            <h3 className="text-sm font-semibold theme-text-primary">Pipeline</h3>
          </div>
          <HelpTooltip label="Explain voice pipeline panel" side="bottom">
            Monitor STT/TTS/telephony provider configuration, adjust pipeline settings, and inspect live
            voice sessions. The actual audio pipeline runs in the Wunderland CLI; this panel shows status
            and lets you edit config that is written back to the runtime on save.
          </HelpTooltip>
        </div>
        <button
          type="button"
          onClick={() => void fetchStatus()}
          disabled={loading}
          title="Refresh voice provider status from the backend."
          className="inline-flex items-center gap-1.5 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2.5 py-1 text-[10px] theme-text-secondary transition hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-400">
          {error}
        </div>
      )}

      {/* Sub-tab strip */}
      <div className="mb-4 flex gap-0.5 overflow-x-auto rounded-lg border theme-border theme-bg-primary p-0.5">
        {SUB_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSubTab(key)}
            title={`Open the ${label} section.`}
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
      {/* Providers tab                                                        */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'providers' && (
        <div className="space-y-4">
          <ProviderGroup title="Speech-to-Text" Icon={Mic}      providers={providers.stt}       />
          <ProviderGroup title="Text-to-Speech" Icon={Volume2}  providers={providers.tts}       />
          <ProviderGroup title="Telephony"       Icon={Phone}    providers={providers.telephony} />
          <p className="text-[10px] leading-relaxed theme-text-muted">
            Set the required environment variable in your shell to configure a provider.
            The backend checks for the key on each refresh.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Config tab                                                           */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'config' && (
        <div className="space-y-4 text-xs">
          {/* Endpointing mode */}
          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Endpointing Mode</p>
            <p className="mb-2 text-[10px] theme-text-secondary">
              Controls how the pipeline decides when the user has stopped speaking.
            </p>
            <div className="space-y-1">
              {(['acoustic', 'heuristic', 'semantic'] as const).map((mode) => {
                const selected = config.endpointing === mode;
                const descriptions: Record<typeof mode, string> = {
                  acoustic:  'Uses audio energy and silence thresholds to detect end-of-utterance.',
                  heuristic: 'Rule-based timing: waits a fixed silence gap after last speech.',
                  semantic:  'Waits until the utterance appears grammatically complete.',
                };
                return (
                  <label
                    key={mode}
                    className={[
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                      selected ? 'border-sky-500/60 bg-sky-500/10' : 'theme-border theme-bg-primary hover:bg-white/5',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="voice-endpointing"
                      checked={selected}
                      onChange={() => updateConfig({ endpointing: mode })}
                      className="mt-0.5 shrink-0 accent-sky-500"
                    />
                    <div>
                      <span className={selected ? 'text-xs font-semibold capitalize text-sky-400' : 'text-xs font-semibold capitalize theme-text-primary'}>
                        {mode}
                      </span>
                      <p className="mt-0.5 text-[10px] theme-text-secondary">{descriptions[mode]}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Barge-in mode */}
          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Barge-In Mode</p>
            <p className="mb-2 text-[10px] theme-text-secondary">
              How the pipeline handles the user speaking while the agent is responding.
            </p>
            <div className="space-y-1">
              {(['hard-cut', 'soft-fade', 'disabled'] as const).map((mode) => {
                const selected = config.bargeIn === mode;
                const labels: Record<typeof mode, string> = {
                  'hard-cut': 'Hard Cut',
                  'soft-fade': 'Soft Fade',
                  disabled: 'Disabled',
                };
                const descriptions: Record<typeof mode, string> = {
                  'hard-cut': 'Immediately stops TTS playback when user speech is detected.',
                  'soft-fade': 'Fades TTS audio out over ~300 ms before stopping.',
                  disabled: 'Agent always completes its response before listening again.',
                };
                return (
                  <label
                    key={mode}
                    className={[
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                      selected ? 'border-sky-500/60 bg-sky-500/10' : 'theme-border theme-bg-primary hover:bg-white/5',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="voice-bargein"
                      checked={selected}
                      onChange={() => updateConfig({ bargeIn: mode })}
                      className="mt-0.5 shrink-0 accent-sky-500"
                    />
                    <div>
                      <span className={selected ? 'text-xs font-semibold text-sky-400' : 'text-xs font-semibold theme-text-primary'}>
                        {labels[mode]}
                      </span>
                      <p className="mt-0.5 text-[10px] theme-text-secondary">{descriptions[mode]}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Diarization + Language + Voice row */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Diarization toggle */}
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Diarization</p>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border theme-border theme-bg-primary px-3 py-2 transition-colors hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={config.diarization}
                  onChange={(e) => updateConfig({ diarization: e.target.checked })}
                  className="shrink-0 accent-sky-500"
                />
                <div>
                  <span className="text-xs font-semibold theme-text-primary">Speaker Diarization</span>
                  <p className="mt-0.5 text-[10px] theme-text-secondary">
                    Label transcript lines by speaker identity.
                  </p>
                </div>
              </label>
            </div>

            {/* Language selector */}
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Language</p>
              <label className="block">
                <select
                  value={config.language}
                  onChange={(e) => updateConfig({ language: e.target.value })}
                  title="Select the primary spoken language for STT recognition."
                  className="w-full rounded-md border theme-border bg-[color:var(--color-background-secondary)] px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish (ES)</option>
                  <option value="es-MX">Spanish (MX)</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="ja-JP">Japanese</option>
                  <option value="zh-CN">Chinese (Simplified)</option>
                  <option value="pt-BR">Portuguese (BR)</option>
                  <option value="ko-KR">Korean</option>
                  <option value="it-IT">Italian</option>
                  <option value="nl-NL">Dutch</option>
                  <option value="pl-PL">Polish</option>
                  <option value="ru-RU">Russian</option>
                  <option value="tr-TR">Turkish</option>
                  <option value="ar-SA">Arabic (SA)</option>
                </select>
              </label>
            </div>

            {/* STT provider picker */}
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">STT Provider</p>
              <label className="block">
                <select
                  value={config.stt}
                  onChange={(e) => updateConfig({ stt: e.target.value })}
                  title="Select the active speech-to-text provider."
                  className="w-full rounded-md border theme-border bg-[color:var(--color-background-secondary)] px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                >
                  {providers.stt.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.configured}>
                      {p.name}{!p.configured ? ' (not configured)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* TTS provider + voice picker */}
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">TTS Provider</p>
              <label className="block">
                <select
                  value={config.tts}
                  onChange={(e) => updateConfig({ tts: e.target.value })}
                  title="Select the active text-to-speech provider."
                  className="w-full rounded-md border theme-border bg-[color:var(--color-background-secondary)] px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                >
                  {providers.tts.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.configured}>
                      {p.name}{!p.configured ? ' (not configured)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* TTS voice name */}
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">TTS Voice</p>
              <label className="block">
                <input
                  value={config.voice}
                  onChange={(e) => updateConfig({ voice: e.target.value })}
                  placeholder="e.g. nova, alloy, rachel"
                  title="Voice identifier used for text-to-speech synthesis."
                  className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                />
              </label>
              <p className="mt-1 text-[10px] theme-text-muted">
                Provider-specific voice name (e.g. "nova" for OpenAI, "rachel" for ElevenLabs).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Sessions tab                                                         */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'sessions' && (
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <MessageSquare size={20} className="theme-text-muted" aria-hidden="true" />
              <p className="text-xs theme-text-secondary">No active voice sessions.</p>
              <p className="text-[10px] theme-text-muted">
                Sessions appear here when the Wunderland voice pipeline is running.
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))
          )}
        </div>
      )}
    </section>
  );
}
