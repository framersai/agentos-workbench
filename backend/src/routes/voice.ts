/**
 * Voice pipeline status routes.
 *
 * Exposes `GET /api/voice/status` — returns:
 *   - Provider availability maps (STT / TTS / telephony) derived from env-var presence.
 *   - Active voice session list (empty in the workbench context; populated by a live
 *     Wunderland CLI voice runtime when one is attached).
 *
 * The route does **not** require any external service calls; it only inspects
 * `process.env` to determine which providers are configured, making it safe to
 * call at any time regardless of whether the voice pipeline is running.
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Provider catalogs
// ---------------------------------------------------------------------------

/**
 * Describes one voice provider entry in the response.
 */
interface VoiceProviderEntry {
  /** Stable id matching the frontend voiceStore defaults. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** True when the required env var is present and non-empty. */
  configured: boolean;
  /** The env var the frontend should tell users to set. */
  envVar: string;
}

/** STT provider catalog — ordered by preference / popularity. */
const STT_PROVIDERS: Omit<VoiceProviderEntry, 'configured'>[] = [
  { id: 'deepgram',   name: 'Deepgram',   envVar: 'DEEPGRAM_API_KEY'   },
  { id: 'openai-stt', name: 'OpenAI STT', envVar: 'OPENAI_API_KEY'     },
  { id: 'assemblyai', name: 'AssemblyAI', envVar: 'ASSEMBLYAI_API_KEY' },
  { id: 'whisper',    name: 'Whisper',    envVar: 'OPENAI_API_KEY'     },
];

/** TTS provider catalog. */
const TTS_PROVIDERS: Omit<VoiceProviderEntry, 'configured'>[] = [
  { id: 'elevenlabs', name: 'ElevenLabs', envVar: 'ELEVENLABS_API_KEY' },
  { id: 'openai-tts', name: 'OpenAI TTS', envVar: 'OPENAI_API_KEY'    },
  { id: 'cartesia',   name: 'Cartesia',   envVar: 'CARTESIA_API_KEY'   },
  { id: 'playht',     name: 'PlayHT',     envVar: 'PLAYHT_API_KEY'     },
];

/** Telephony provider catalog. */
const TELEPHONY_PROVIDERS: Omit<VoiceProviderEntry, 'configured'>[] = [
  { id: 'twilio', name: 'Twilio', envVar: 'TWILIO_ACCOUNT_SID' },
  { id: 'telnyx', name: 'Telnyx', envVar: 'TELNYX_API_KEY'     },
  { id: 'plivo',  name: 'Plivo',  envVar: 'PLIVO_AUTH_ID'      },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Resolves the `configured` flag for each entry in a provider catalog by
 * checking whether the corresponding env var is present and non-empty in
 * `process.env`.
 */
function resolveProviders(
  catalog: Omit<VoiceProviderEntry, 'configured'>[],
): VoiceProviderEntry[] {
  return catalog.map((entry) => ({
    ...entry,
    configured: Boolean(process.env[entry.envVar]?.trim()),
  }));
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Registers voice pipeline routes on the provided Fastify instance.
 * Intended to be mounted at `/api/voice` in the main server.
 *
 * @param fastify - Fastify server instance.
 */
export default async function voiceRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/voice/status
   *
   * Returns env-var-based provider availability and the current active voice
   * session list.  In a workbench-only environment the sessions array is always
   * empty; a running Wunderland voice runtime can push updates via its own
   * mechanism in the future.
   */
  fastify.get('/status', {
    schema: {
      description: 'Return voice pipeline provider configuration status and active sessions',
      tags: ['Voice'],
      response: {
        200: {
          type: 'object',
          properties: {
            providers: {
              type: 'object',
              properties: {
                stt: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id:         { type: 'string' },
                      name:       { type: 'string' },
                      configured: { type: 'boolean' },
                      envVar:     { type: 'string' },
                    },
                    required: ['id', 'name', 'configured', 'envVar'],
                  },
                },
                tts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id:         { type: 'string' },
                      name:       { type: 'string' },
                      configured: { type: 'boolean' },
                      envVar:     { type: 'string' },
                    },
                    required: ['id', 'name', 'configured', 'envVar'],
                  },
                },
                telephony: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id:         { type: 'string' },
                      name:       { type: 'string' },
                      configured: { type: 'boolean' },
                      envVar:     { type: 'string' },
                    },
                    required: ['id', 'name', 'configured', 'envVar'],
                  },
                },
              },
              required: ['stt', 'tts', 'telephony'],
            },
            sessions: {
              type: 'array',
              description: 'Active voice pipeline sessions reported by the runtime.',
              items: {
                type: 'object',
                properties: {
                  id:       { type: 'string' },
                  state:    { type: 'string' },
                  turns:    { type: 'number' },
                  duration: { type: 'number' },
                  transcript: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        speaker: { type: 'string' },
                        text:    { type: 'string' },
                      },
                      required: ['speaker', 'text'],
                    },
                  },
                },
                required: ['id', 'state', 'turns', 'duration', 'transcript'],
              },
            },
          },
          required: ['providers', 'sessions'],
        },
      },
    },
  }, async () => {
    return {
      providers: {
        stt:       resolveProviders(STT_PROVIDERS),
        tts:       resolveProviders(TTS_PROVIDERS),
        telephony: resolveProviders(TELEPHONY_PROVIDERS),
      },
      // Active sessions are populated by a live Wunderland voice runtime.
      // The workbench backend exposes an empty list by default.
      sessions: [],
    };
  });

  // ---------------------------------------------------------------------------
  // Call history routes
  // ---------------------------------------------------------------------------

  /**
   * Demo call store — populated once per process lifetime with stable fake data.
   * In a production deployment this would query a call recording / CDR service.
   */
  const NOW = Date.now();
  const DEMO_CALLS = [
    {
      id: 'call-001',
      callerId: '+1 (555) 010-0001',
      startedAt: new Date(NOW - 5 * 60_000).toISOString(),
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
      startedAt: new Date(NOW - 22 * 60_000).toISOString(),
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
      startedAt: new Date(NOW - 60 * 60_000).toISOString(),
      durationSeconds: 210,
      turnCount: 14,
      transcriptPreview: 'I placed an order three days ago...',
      hasRecording: true,
      sttProvider: 'deepgram',
      ttsProvider: 'cartesia',
      providerChain: ['deepgram', 'assemblyai'],
    },
  ];

  const DEMO_TRANSCRIPT = [
    { speaker: 'Caller', text: 'Hi, I need help resetting my password.',                         timestamp: new Date(NOW - 4 * 60_000).toISOString()   },
    { speaker: 'Agent',  text: 'Sure! I can help you with that. Can you confirm your email?',    timestamp: new Date(NOW - 3.8 * 60_000).toISOString() },
    { speaker: 'Caller', text: "Yes it's user@example.com",                                      timestamp: new Date(NOW - 3.5 * 60_000).toISOString() },
    { speaker: 'Agent',  text: "Thank you. I'll send a reset link to that address now.",         timestamp: new Date(NOW - 3.2 * 60_000).toISOString() },
    { speaker: 'Caller', text: 'Oh wait — actually',                                             timestamp: new Date(NOW - 3 * 60_000).toISOString(),    bargedIn: true },
    { speaker: 'Agent',  text: 'Go ahead.',                                                      timestamp: new Date(NOW - 2.9 * 60_000).toISOString() },
    { speaker: 'Caller', text: "I think the email might be different. Let me check.",            timestamp: new Date(NOW - 2.7 * 60_000).toISOString() },
    { speaker: 'Agent',  text: "Take your time, I'm here whenever you're ready.",                timestamp: new Date(NOW - 2.5 * 60_000).toISOString() },
  ];

  /**
   * GET /api/voice/calls
   *
   * Returns a list of historical voice calls ordered newest-first.
   */
  fastify.get('/calls', {
    schema: {
      description: 'Return historical voice call records',
      tags: ['Voice'],
      response: {
        200: {
          type: 'object',
          properties: {
            calls: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
  }, async () => {
    return { calls: DEMO_CALLS };
  });

  /**
   * GET /api/voice/calls/:id/transcript
   *
   * Returns the full timestamped transcript for a specific call.
   */
  fastify.get<{ Params: { id: string } }>('/calls/:id/transcript', {
    schema: {
      description: 'Return the full transcript for a specific voice call',
      tags: ['Voice'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            transcript: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
  }, async (request) => {
    // In demo mode all calls share the same transcript.  The id is acknowledged
    // so the route signature is correct for a real implementation.
    void request.params.id;
    void crypto; // referenced to keep the import used
    return { transcript: DEMO_TRANSCRIPT };
  });
}
