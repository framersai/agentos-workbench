/**
 * voiceCallStore — Zustand store for live call monitoring.
 *
 * Manages the list of historical calls, the currently-selected call's full
 * transcript, audio metrics, and barge-in flash state.  Calls are fetched
 * from `GET /api/voice/calls`; individual transcripts from
 * `GET /api/voice/calls/:id/transcript`.
 */

import { create } from 'zustand';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single timestamped transcript entry with speaker label.
 */
export interface CallTranscriptLine {
  /** "Agent" | "Caller" or any diarization label. */
  speaker: 'Agent' | 'Caller' | string;
  /** Transcribed text. */
  text: string;
  /** ISO-8601 timestamp string. */
  timestamp: string;
  /** When true the agent was barged in on this turn. */
  bargedIn?: boolean;
}

/**
 * Summary record for a completed or in-progress voice call.
 */
export interface VoiceCall {
  id: string;
  /** Display-friendly caller ID or phone number. */
  callerId: string;
  /** Call start time as ISO-8601 string. */
  startedAt: string;
  /** Duration in seconds, undefined if still active. */
  durationSeconds?: number;
  /** Number of completed turns. */
  turnCount: number;
  /** First few words of the transcript for preview. */
  transcriptPreview: string;
  /** Whether a recording is available. */
  hasRecording: boolean;
  /** STT provider used, e.g. "deepgram". */
  sttProvider: string;
  /** TTS provider used, e.g. "openai-tts". */
  ttsProvider: string;
  /** STT/TTS fallback chain that was evaluated. */
  providerChain: string[];
}

/**
 * Real-time audio metrics for the active call.
 */
export interface AudioMetrics {
  /** Round-trip latency in ms (STT + LLM + TTS). */
  latencyMs: number;
  /** Voice Activity Detection confidence 0–1. */
  vadConfidence: number;
  /** Active endpointing mode. */
  endpointMode: 'acoustic' | 'heuristic' | 'semantic';
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface VoiceCallState {
  /** List of historical calls ordered newest-first. */
  calls: VoiceCall[];
  /** Full transcript of the selected call. */
  activeCallTranscript: CallTranscriptLine[];
  /** ID of the call whose transcript is currently loaded. */
  selectedCallId: string | null;
  /** When true, show the barge-in flash indicator. */
  bargeInFlash: boolean;
  /** Text that was interrupted when barge-in occurred. */
  bargeInText: string;
  /** Real-time audio metrics for the most-recent active call. */
  audioMetrics: AudioMetrics;
  /** Whether a fetch is in flight. */
  loading: boolean;
  /** Whether the transcript fetch is in flight. */
  transcriptLoading: boolean;
  /** Last error string or null. */
  error: string | null;

  // --- Actions ---

  /** Fetch the calls list from the backend. */
  fetchCalls: () => Promise<void>;
  /** Fetch the full transcript for a specific call. */
  fetchTranscript: (callId: string) => Promise<void>;
  /** Trigger the barge-in flash indicator for 2 s. */
  triggerBargeIn: (interruptedText: string) => void;
  /** Update real-time audio metrics (called from a polling tick). */
  setAudioMetrics: (metrics: Partial<AudioMetrics>) => void;
}

// ---------------------------------------------------------------------------
// Default data (shown while backend is unavailable)
// ---------------------------------------------------------------------------

const DEMO_CALLS: VoiceCall[] = [
  {
    id: 'call-001',
    callerId: '+1 (555) 010-0001',
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    durationSeconds: 142,
    turnCount: 8,
    transcriptPreview: 'Hi, I need help resetting my password...',
    hasRecording: true,
    sttProvider: 'deepgram',
    ttsProvider: 'openai-tts',
    providerChain: ['deepgram', 'openai-stt', 'assemblyai'],
  },
  {
    id: 'call-002',
    callerId: '+1 (555) 010-0002',
    startedAt: new Date(Date.now() - 22 * 60_000).toISOString(),
    durationSeconds: 87,
    turnCount: 5,
    transcriptPreview: 'Can you tell me the business hours?',
    hasRecording: false,
    sttProvider: 'openai-stt',
    ttsProvider: 'elevenlabs',
    providerChain: ['openai-stt', 'deepgram'],
  },
  {
    id: 'call-003',
    callerId: '+1 (555) 010-0003',
    startedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    durationSeconds: 210,
    turnCount: 14,
    transcriptPreview: 'I placed an order three days ago...',
    hasRecording: true,
    sttProvider: 'deepgram',
    ttsProvider: 'cartesia',
    providerChain: ['deepgram', 'assemblyai'],
  },
];

const DEMO_TRANSCRIPT: CallTranscriptLine[] = [
  { speaker: 'Caller', text: 'Hi, I need help resetting my password.', timestamp: new Date(Date.now() - 4 * 60_000).toISOString() },
  { speaker: 'Agent',  text: 'Sure! I can help you with that. Can you confirm your email address?', timestamp: new Date(Date.now() - 3.8 * 60_000).toISOString() },
  { speaker: 'Caller', text: 'Yes it\'s user@example.com', timestamp: new Date(Date.now() - 3.5 * 60_000).toISOString() },
  { speaker: 'Agent',  text: 'Thank you. I\'ll send a reset link to that address now.', timestamp: new Date(Date.now() - 3.2 * 60_000).toISOString() },
  { speaker: 'Caller', text: 'Oh wait — actually', timestamp: new Date(Date.now() - 3 * 60_000).toISOString(), bargedIn: true },
  { speaker: 'Agent',  text: 'Go ahead.', timestamp: new Date(Date.now() - 2.9 * 60_000).toISOString() },
  { speaker: 'Caller', text: 'I think the email might be different. Let me check.', timestamp: new Date(Date.now() - 2.7 * 60_000).toISOString() },
  { speaker: 'Agent',  text: 'Take your time, I\'m here whenever you\'re ready.', timestamp: new Date(Date.now() - 2.5 * 60_000).toISOString() },
];

const DEFAULT_METRICS: AudioMetrics = {
  latencyMs: 0,
  vadConfidence: 0,
  endpointMode: 'acoustic',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useVoiceCallStore = create<VoiceCallState>()((set, get) => ({
  calls: DEMO_CALLS,
  activeCallTranscript: [],
  selectedCallId: null,
  bargeInFlash: false,
  bargeInText: '',
  audioMetrics: DEFAULT_METRICS,
  loading: false,
  transcriptLoading: false,
  error: null,

  fetchCalls: async () => {
    set({ loading: true, error: null });
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const res = await fetch(`${base}/api/voice/calls`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { calls: VoiceCall[] };
      set({ loading: false, calls: data.calls ?? DEMO_CALLS });
    } catch {
      // Fall back to demo data so the panel is always usable offline.
      set({ loading: false, calls: DEMO_CALLS });
    }
  },

  fetchTranscript: async (callId) => {
    set({ transcriptLoading: true, selectedCallId: callId });
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const res = await fetch(`${base}/api/voice/calls/${callId}/transcript`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { transcript: CallTranscriptLine[] };
      set({ transcriptLoading: false, activeCallTranscript: data.transcript ?? DEMO_TRANSCRIPT });
    } catch {
      set({ transcriptLoading: false, activeCallTranscript: DEMO_TRANSCRIPT });
    }
  },

  triggerBargeIn: (interruptedText) => {
    set({ bargeInFlash: true, bargeInText: interruptedText });
    setTimeout(() => set({ bargeInFlash: false }), 2000);
  },

  setAudioMetrics: (metrics) =>
    set((s) => ({ audioMetrics: { ...s.audioMetrics, ...metrics } })),
}));
