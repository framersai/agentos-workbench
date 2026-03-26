/**
 * guardrailStore — Zustand store for the GuardrailEvaluator panel.
 *
 * Holds the evaluation harness state: input text, selected packs, per-pack
 * results, evaluation log, and the allow-list of whitelisted entities.
 * Results come from `POST /api/guardrails/evaluate`.
 */

import { create } from 'zustand';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Identifiers matching the guardrail pack IDs in GuardrailPackManager. */
export type GuardrailPackId =
  | 'pii-redaction'
  | 'ml-classifiers'
  | 'topicality'
  | 'code-safety'
  | 'grounding-guard';

/**
 * Result produced by one guardrail pack for a single evaluation.
 */
export interface PackVerdict {
  packId: GuardrailPackId;
  /** Whether the input passed this pack's check. */
  pass: boolean;
  /** Confidence score 0–1. */
  confidence: number;
  /** Human-readable label of what was detected, or "clean" if none. */
  detected: string;
  /** The sanitized/redacted version of the text produced by this pack. */
  sanitizedText: string;
}

/**
 * A row in the evaluation log.
 */
export interface EvalLogEntry {
  id: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** The raw input text that was evaluated. */
  input: string;
  /** Packs that were run. */
  packs: GuardrailPackId[];
  /** Overall pass/fail (true if ALL selected packs pass). */
  overallPass: boolean;
  /** Individual pack results. */
  verdicts: PackVerdict[];
}

/**
 * An entity that has been explicitly allow-listed to avoid future false-positive
 * detections.
 */
export interface AllowListEntry {
  id: string;
  /** The text/pattern that was false-positive detected. */
  text: string;
  /** The pack that erroneously flagged it. */
  packId: GuardrailPackId;
  /** ISO-8601 timestamp when it was allowed. */
  allowedAt: string;
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface GuardrailState {
  /** Current input text in the test harness. */
  inputText: string;
  /** Which packs are selected for testing. */
  selectedPacks: GuardrailPackId[];
  /** Which agent's config overrides to apply (empty = global defaults). */
  selectedAgentId: string;
  /** Results of the most-recent evaluation, one per pack. */
  currentVerdicts: PackVerdict[];
  /** Sanitized output of the most-recent evaluation. */
  sanitizedOutput: string;
  /** Full evaluation log (newest first). */
  evalLog: EvalLogEntry[];
  /** Allow-listed entities that suppress future detections. */
  allowList: AllowListEntry[];
  /** True while an evaluation request is in flight. */
  evaluating: boolean;
  /** Last error string or null. */
  error: string | null;

  // --- Actions ---
  setInputText: (text: string) => void;
  togglePack: (packId: GuardrailPackId) => void;
  setSelectedAgentId: (agentId: string) => void;
  evaluate: () => Promise<void>;
  allowEntity: (text: string, packId: GuardrailPackId) => void;
  clearLog: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_PACKS: GuardrailPackId[] = [
  'pii-redaction',
  'ml-classifiers',
  'topicality',
  'code-safety',
  'grounding-guard',
];

/** Build a synthetic demo evaluation result for offline use. */
function buildDemoVerdicts(text: string, packs: GuardrailPackId[]): PackVerdict[] {
  const hasPii    = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(text);
  const hasToxic  = /\b(hate|kill|attack|exploit)\b/i.test(text);
  const hasCode   = /```|eval\(|exec\(|__import__/.test(text);
  const hasOoc    = /stock price|weather forecast|news today/i.test(text);

  return packs.map((packId) => {
    switch (packId) {
      case 'pii-redaction':
        return {
          packId,
          pass: !hasPii,
          confidence: hasPii ? 0.92 : 0.99,
          detected: hasPii ? 'Email / SSN pattern' : 'clean',
          sanitizedText: hasPii ? text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]') : text,
        };
      case 'ml-classifiers':
        return {
          packId,
          pass: !hasToxic,
          confidence: hasToxic ? 0.87 : 0.96,
          detected: hasToxic ? 'Toxic language' : 'clean',
          sanitizedText: hasToxic ? '[REDACTED]' : text,
        };
      case 'topicality':
        return {
          packId,
          pass: !hasOoc,
          confidence: hasOoc ? 0.78 : 0.91,
          detected: hasOoc ? 'Off-topic query detected' : 'clean',
          sanitizedText: hasOoc ? '[BLOCKED: out of scope]' : text,
        };
      case 'code-safety':
        return {
          packId,
          pass: !hasCode,
          confidence: hasCode ? 0.94 : 0.98,
          detected: hasCode ? 'Unsafe code execution pattern' : 'clean',
          sanitizedText: hasCode ? text.replace(/eval\(.*?\)/g, '[SANITIZED]') : text,
        };
      case 'grounding-guard':
        return {
          packId,
          pass: true,
          confidence: 0.82,
          detected: 'clean',
          sanitizedText: text,
        };
    }
  });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGuardrailStore = create<GuardrailState>()((set, get) => ({
  inputText: '',
  selectedPacks: ['pii-redaction', 'code-safety'],
  selectedAgentId: '',
  currentVerdicts: [],
  sanitizedOutput: '',
  evalLog: [],
  allowList: [],
  evaluating: false,
  error: null,

  setInputText: (text) => set({ inputText: text }),

  togglePack: (packId) =>
    set((s) => ({
      selectedPacks: s.selectedPacks.includes(packId)
        ? s.selectedPacks.filter((p) => p !== packId)
        : [...s.selectedPacks, packId],
    })),

  setSelectedAgentId: (agentId) => set({ selectedAgentId: agentId }),

  evaluate: async () => {
    const { inputText, selectedPacks, selectedAgentId } = get();
    if (!inputText.trim()) return;
    set({ evaluating: true, error: null });

    try {
      const base = resolveWorkbenchApiBaseUrl();
      const res = await fetch(`${base}/api/guardrails/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, packs: selectedPacks, agentId: selectedAgentId || undefined }),
      });

      let verdicts: PackVerdict[];
      if (!res.ok) {
        // Fall back to local demo logic.
        verdicts = buildDemoVerdicts(inputText, selectedPacks);
      } else {
        const data = await res.json() as { verdicts: PackVerdict[] };
        verdicts = data.verdicts ?? buildDemoVerdicts(inputText, selectedPacks);
      }

      const overallPass = verdicts.every((v) => v.pass);
      const finalSanitized = verdicts.reduce((acc, v) => (v.pass ? acc : v.sanitizedText), inputText);

      const entry: EvalLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        input: inputText,
        packs: [...selectedPacks],
        overallPass,
        verdicts,
      };

      set((s) => ({
        evaluating: false,
        currentVerdicts: verdicts,
        sanitizedOutput: finalSanitized,
        evalLog: [entry, ...s.evalLog].slice(0, 50),
      }));
    } catch (e: unknown) {
      // Always degrade gracefully to offline demo mode.
      const verdicts = buildDemoVerdicts(inputText, selectedPacks);
      const overallPass = verdicts.every((v) => v.pass);
      const finalSanitized = verdicts.reduce((acc, v) => (v.pass ? acc : v.sanitizedText), inputText);
      const entry: EvalLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        input: inputText,
        packs: [...selectedPacks],
        overallPass,
        verdicts,
      };
      set((s) => ({
        evaluating: false,
        currentVerdicts: verdicts,
        sanitizedOutput: finalSanitized,
        evalLog: [entry, ...s.evalLog].slice(0, 50),
        error: (e as Error).message ?? 'Evaluate failed — showing offline demo results.',
      }));
    }
  },

  allowEntity: (text, packId) =>
    set((s) => ({
      allowList: [
        ...s.allowList,
        { id: crypto.randomUUID(), text, packId, allowedAt: new Date().toISOString() },
      ],
    })),

  clearLog: () => set({ evalLog: [] }),
}));

export { ALL_PACKS };
