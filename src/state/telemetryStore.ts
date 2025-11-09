import { create } from "zustand";
import { AgentOSChunkType, type AgentOSResponse, type AgentOSFinalResponseChunk, type AgentOSTextDeltaChunk, type AgentOSToolCallRequestChunk } from "@/types/agentos";

export interface TelemetryMetrics {
  startedAt?: number;
  lastEventAt?: number;
  durationMs?: number;
  chunks: number;
  textDeltaChars: number;
  toolCalls: number;
  errors: number;
  finalTokensPrompt?: number;
  finalTokensCompletion?: number;
  finalTokensTotal?: number;
}

interface TelemetryState {
  perSession: Record<string, TelemetryMetrics>;
  currentSessionId?: string;
  startStream: (sessionId: string) => void;
  noteChunk: (sessionId: string, chunk: AgentOSResponse) => void;
  endStream: (sessionId: string) => void;
}

export const useTelemetryStore = create<TelemetryState>()((set) => ({
  perSession: {},
  currentSessionId: undefined,
  startStream: (sessionId) => {
    set((state) => ({
      currentSessionId: sessionId,
      perSession: {
        ...state.perSession,
        [sessionId]: {
          startedAt: Date.now(),
          lastEventAt: undefined,
          durationMs: undefined,
          chunks: 0,
          textDeltaChars: 0,
          toolCalls: 0,
          errors: 0,
        }
      }
    }));
  },
  noteChunk: (sessionId, chunk) => {
    set((state) => {
      const prev = state.perSession[sessionId] || { chunks: 0, textDeltaChars: 0, toolCalls: 0, errors: 0 } as TelemetryMetrics;
      const next: TelemetryMetrics = { ...prev, lastEventAt: Date.now(), chunks: (prev.chunks || 0) + 1 };
      switch (chunk.type) {
        case AgentOSChunkType.TEXT_DELTA: {
          const c = chunk as AgentOSTextDeltaChunk;
          next.textDeltaChars = (next.textDeltaChars || 0) + (c.textDelta?.length || 0);
          break;
        }
        case AgentOSChunkType.TOOL_CALL_REQUEST: {
          const c = chunk as AgentOSToolCallRequestChunk;
          next.toolCalls = (next.toolCalls || 0) + (c.toolCalls?.length || 1);
          break;
        }
        case AgentOSChunkType.ERROR: {
          next.errors = (next.errors || 0) + 1;
          break;
        }
        case AgentOSChunkType.FINAL_RESPONSE: {
          const f = chunk as AgentOSFinalResponseChunk;
          if (f.usage) {
            next.finalTokensPrompt = f.usage.promptTokens;
            next.finalTokensCompletion = f.usage.completionTokens;
            next.finalTokensTotal = f.usage.totalTokens;
          }
          break;
        }
      }
      return {
        perSession: { ...state.perSession, [sessionId]: next }
      };
    });
  },
  endStream: (sessionId) => {
    set((state) => {
      const prev = state.perSession[sessionId];
      if (!prev) return state;
      const durationMs = prev.startedAt ? (Date.now() - prev.startedAt) : prev.durationMs;
      return { perSession: { ...state.perSession, [sessionId]: { ...prev, durationMs } } };
    });
  }
}));


