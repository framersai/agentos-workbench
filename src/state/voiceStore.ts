import { create } from 'zustand';
import { getVoiceStatus, type VoiceStatusResponse } from '@/lib/agentosClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A configured voice provider (STT, TTS, or telephony).
 */
export interface VoiceProvider {
  /** Stable identifier, e.g. "deepgram", "elevenlabs". */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** True when the required env var is present and non-empty in the backend process. */
  configured: boolean;
  /** The environment variable name that must be set to configure this provider. */
  envVar: string;
}

/**
 * A line in a voice session's transcript.
 */
export interface TranscriptLine {
  /** "agent" | "user" or any speaker label from diarization. */
  speaker: string;
  /** Transcribed or synthesised text. */
  text: string;
}

/**
 * A live voice pipeline session as reported by the runtime.
 */
export interface VoiceSession {
  id: string;
  /** Current pipeline state. */
  state: 'listening' | 'processing' | 'speaking' | 'idle' | string;
  /** Number of completed back-and-forth turns. */
  turns: number;
  /** Elapsed duration in seconds. */
  duration: number;
  /** Running transcript for this session. */
  transcript: TranscriptLine[];
}

/**
 * Pipeline configuration options that the workbench can set.
 */
export interface VoiceConfig {
  /** How the pipeline decides when the user has finished speaking. */
  endpointing: 'acoustic' | 'heuristic' | 'semantic';
  /** How a speech-in-progress response is interrupted. */
  bargeIn: 'hard-cut' | 'soft-fade' | 'disabled';
  /** Whether speaker diarization is enabled. */
  diarization: boolean;
  /** BCP-47 language tag, e.g. "en-US". */
  language: string;
  /** Voice identifier for TTS synthesis, e.g. "nova". */
  voice: string;
  /** Active STT provider id. */
  stt: string;
  /** Active TTS provider id. */
  tts: string;
}

/**
 * Shape of provider lists held in the store.
 */
export interface VoiceProviders {
  stt: VoiceProvider[];
  tts: VoiceProvider[];
  telephony: VoiceProvider[];
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

/**
 * Zustand state for the voice pipeline panel.
 *
 * Remote data (providers, sessions) is fetched via `fetchStatus`.
 * Config changes are applied locally via `updateConfig` so the panel
 * stays responsive while the backend is absent.
 */
interface VoiceState {
  /** STT / TTS / telephony provider availability maps. */
  providers: VoiceProviders;

  /** User-editable pipeline configuration. */
  config: VoiceConfig;

  /** Active voice sessions reported by the runtime. */
  sessions: VoiceSession[];

  /** True while a fetch is in flight. */
  loading: boolean;

  /** Last error message, or null when none. */
  error: string | null;

  // --- Actions ---

  /** Merge a partial config update into the stored config. */
  updateConfig: (partial: Partial<VoiceConfig>) => void;

  /** Replace the full sessions list. */
  setSessions: (sessions: VoiceSession[]) => void;

  /** Replace the full providers map. */
  setProviders: (providers: VoiceProviders) => void;

  /** Fetch live provider status from the backend `/api/voice/status` endpoint. */
  fetchStatus: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDERS: VoiceProviders = {
  stt: [
    { id: 'deepgram',    name: 'Deepgram',    configured: false, envVar: 'DEEPGRAM_API_KEY'    },
    { id: 'openai-stt',  name: 'OpenAI STT',  configured: false, envVar: 'OPENAI_API_KEY'      },
    { id: 'assemblyai',  name: 'AssemblyAI',  configured: false, envVar: 'ASSEMBLYAI_API_KEY'  },
    { id: 'whisper',     name: 'Whisper',     configured: false, envVar: 'OPENAI_API_KEY'      },
  ],
  tts: [
    { id: 'elevenlabs',  name: 'ElevenLabs',  configured: false, envVar: 'ELEVENLABS_API_KEY'  },
    { id: 'openai-tts',  name: 'OpenAI TTS',  configured: false, envVar: 'OPENAI_API_KEY'      },
    { id: 'cartesia',    name: 'Cartesia',    configured: false, envVar: 'CARTESIA_API_KEY'    },
    { id: 'playht',      name: 'PlayHT',      configured: false, envVar: 'PLAYHT_API_KEY'      },
  ],
  telephony: [
    { id: 'twilio',  name: 'Twilio',  configured: false, envVar: 'TWILIO_ACCOUNT_SID'  },
    { id: 'telnyx',  name: 'Telnyx',  configured: false, envVar: 'TELNYX_API_KEY'       },
    { id: 'plivo',   name: 'Plivo',   configured: false, envVar: 'PLIVO_AUTH_ID'        },
  ],
};

const DEFAULT_CONFIG: VoiceConfig = {
  endpointing: 'acoustic',
  bargeIn:     'hard-cut',
  diarization: false,
  language:    'en-US',
  voice:       'nova',
  stt:         'deepgram',
  tts:         'openai-tts',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Zustand store for the Voice Pipeline panel.
 *
 * Usage:
 * ```tsx
 * const { providers, config, updateConfig, fetchStatus } = useVoiceStore();
 * ```
 */
export const useVoiceStore = create<VoiceState>()((set) => ({
  providers: DEFAULT_PROVIDERS,
  config:    DEFAULT_CONFIG,
  sessions:  [],
  loading:   false,
  error:     null,

  updateConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  setSessions: (sessions) => set({ sessions }),

  setProviders: (providers) => set({ providers }),

  fetchStatus: async () => {
    set({ loading: true, error: null });
    try {
      const data: VoiceStatusResponse = await getVoiceStatus();

      // Merge backend-reported configured flags onto the default provider list.
      const mergeConfigured = (
        defaults: VoiceProvider[],
        reported: VoiceStatusResponse['providers']['stt'] | VoiceStatusResponse['providers']['tts'] | VoiceStatusResponse['providers']['telephony'],
      ): VoiceProvider[] => {
        const reportedMap = new Map(reported.map((p) => [p.id, p.configured]));
        return defaults.map((d) => ({
          ...d,
          configured: reportedMap.has(d.id) ? (reportedMap.get(d.id) ?? d.configured) : d.configured,
        }));
      };

      set({
        loading: false,
        providers: {
          stt:       mergeConfigured(DEFAULT_PROVIDERS.stt,       data.providers.stt),
          tts:       mergeConfigured(DEFAULT_PROVIDERS.tts,       data.providers.tts),
          telephony: mergeConfigured(DEFAULT_PROVIDERS.telephony, data.providers.telephony),
        },
        sessions: data.sessions ?? [],
      });
    } catch (e: unknown) {
      set({ loading: false, error: (e as Error).message ?? 'Failed to fetch voice status' });
    }
  },
}));
