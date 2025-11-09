import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/utils/idbStorage";
import type {
  AgentOSAgencyUpdateChunk,
  AgentOSResponse,
  AgentOSWorkflowUpdateChunk
} from "@/types/agentos";

export type SessionEvent = {
  id: string;
  timestamp: number;
  type: AgentOSResponse["type"] | "log";
  payload: AgentOSResponse | { message: string; level?: "info" | "warning" | "error" };
};

export type SessionTargetType = "persona" | "agency";

export interface PersonaDefinition {
  id: string;
  displayName: string;
  description?: string;
  archetype?: string;
  tags?: string[];
  traits?: string[];
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  source?: "remote" | "local";
}

export interface PersonaFilters {
  search: string;
  capabilities: string[];
}

export interface AgencyParticipantDefinition {
  roleId: string;
  personaId?: string;
  notes?: string;
}

export interface AgencyDefinition {
  id: string;
  name: string;
  goal?: string;
  workflowId?: string;
  participants: AgencyParticipantDefinition[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** A single local client session with AgentOS timeline events. */
export interface AgentSession {
  id: string;
  targetType: SessionTargetType;
  displayName: string;
  personaId?: string;
  agencyId?: string;
  status: "idle" | "streaming" | "error";
  events: SessionEvent[];
}

export type SessionUpdate = Partial<Omit<AgentSession, "id">> & Pick<AgentSession, "id">;

/**
 * Local client state persisted to IndexedDB via a minimal storage wrapper.
 * No server writes. Users can export/import JSON to move data.
 */
interface SessionState {
  sessions: AgentSession[];
  personas: PersonaDefinition[];
  agencies: AgencyDefinition[];
  agencySessions: Record<string, AgentOSAgencyUpdateChunk["agency"]>;
  workflowSnapshots: Record<string, AgentOSWorkflowUpdateChunk["workflow"]>;
  activeSessionId: string | null;
  activeAgencyId: string | null;
  personaFilters: PersonaFilters;
  upsertSession: (session: SessionUpdate) => void;
  appendEvent: (sessionId: string, event: SessionEvent) => void;
  setActiveSession: (sessionId: string) => void;
  addPersona: (persona: PersonaDefinition) => void;
  setPersonas: (personas: PersonaDefinition[]) => void;
  updatePersona: (personaId: string, updates: Partial<PersonaDefinition>) => void;
  removePersona: (personaId: string) => void;
  addAgency: (agency: AgencyDefinition) => void;
  updateAgency: (agencyId: string, updates: Partial<AgencyDefinition>) => void;
  removeAgency: (agencyId: string) => void;
  setActiveAgency: (agencyId: string | null) => void;
  setPersonaFilters: (filters: Partial<PersonaFilters>) => void;
  applyAgencySnapshot: (agency: AgentOSAgencyUpdateChunk["agency"]) => void;
  applyWorkflowSnapshot: (workflow: AgentOSWorkflowUpdateChunk["workflow"]) => void;
  removeWorkflowSnapshot: (workflowId: string) => void;
  clearWorkflowSnapshots: () => void;
  /** Deletes one session by id. */
  removeSession: (sessionId: string) => void;
  /** Clears all local data (personas reset to defaults). */
  clearAll: () => void;
}

const defaultPersonas: PersonaDefinition[] = [
  {
    id: "atlas-systems-architect",
    displayName: "Atlas Systems Architect",
    description: "Designs resilient multi-agent topologies and long-running workflows.",
    tags: ["systems", "architecture"],
    traits: ["Analytical", "Calm", "Long-horizon planning"],
    capabilities: ["workflow-authoring", "policy-audits"],
    metadata: { tier: "pro" },
    source: "local"
  },
  {
    id: "meridian-product-strategist",
    displayName: "Meridian Product Strategist",
    description: "Synthesises customer signals and agent telemetry into actionable roadmaps.",
    tags: ["product", "strategy"],
    traits: ["Collaborative", "Outcomes-first"],
    capabilities: ["insight-synthesis", "agency-briefing"],
    source: "local"
  },
  {
    id: "solstice-research-analyst",
    displayName: "Solstice Research Analyst",
    description: "Conducts rapid literature reviews and evaluates emergent agency behaviour.",
    tags: ["research", "analysis"],
    traits: ["Curious", "Rigorous"],
    capabilities: ["rag", "agency-observation"],
    source: "local"
  }
];

const storageShim: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0
};

const persistedStorage = createJSONStorage<SessionState>(() => (typeof window !== "undefined" ? (idbStorage as Storage) : storageShim));

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessions: [],
      personas: defaultPersonas,
      agencies: [],
      agencySessions: {},
      workflowSnapshots: {},
      activeSessionId: null,
      activeAgencyId: null,
      personaFilters: {
        search: "",
        capabilities: []
      },
      upsertSession: (session) =>
        set((state) => {
          const existingIndex = state.sessions.findIndex((s) => s.id === session.id);
          if (existingIndex === -1) {
            const nextSession: AgentSession = {
              id: session.id,
              targetType: session.targetType ?? "persona",
              displayName: session.displayName ?? "Untitled session",
              personaId: session.personaId,
              agencyId: session.agencyId,
              status: session.status ?? "idle",
              events: session.events ?? []
            };
            return { sessions: [nextSession, ...state.sessions].slice(0, 25) };
          }
          const nextSessions = [...state.sessions];
          nextSessions[existingIndex] = {
            ...nextSessions[existingIndex],
            ...session,
            events: session.events ?? nextSessions[existingIndex].events
          };
          return { sessions: nextSessions };
        }),
      appendEvent: (sessionId, event) =>
        set((state) => {
          const nextSessions = state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  events:
                    session.events.length >= 200
                      ? [...session.events.slice(1), event]
                      : [...session.events, event]
                }
              : session
          );
          return { sessions: nextSessions };
        }),
      removeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId
        })),
      clearAll: () =>
        set(() => ({
          sessions: [],
          agencies: [],
          personas: defaultPersonas,
          activeSessionId: null,
          activeAgencyId: null,
          agencySessions: {},
          workflowSnapshots: {}
        })),
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
      addPersona: (persona) =>
        set((state) => {
          const normalized: PersonaDefinition = {
            ...persona,
            source: persona.source ?? "local"
          };
          const exists = state.personas.some((item) => item.id === normalized.id);
          const personas = exists
            ? state.personas.map((item) => (item.id === normalized.id ? { ...item, ...normalized } : item))
            : [normalized, ...state.personas];
          return { personas };
        }),
      setPersonas: (personas) =>
        set((state) => {
          const incoming = personas
            .map<PersonaDefinition | null>((persona) => {
              if (!persona.id) {
                return null;
              }
              return {
                ...persona,
                source: persona.source ?? "remote"
              };
            })
            .filter((persona): persona is PersonaDefinition => Boolean(persona));

          if (incoming.length === 0) {
            return {};
          }

          const incomingIds = new Set(incoming.map((persona) => persona.id));
          const preserved = state.personas.filter(
            (persona) => !incomingIds.has(persona.id) && persona.source !== "remote"
          );

          return { personas: [...incoming, ...preserved] };
        }),
      updatePersona: (personaId, updates) =>
        set((state) => ({
          personas: state.personas.map((persona) => (persona.id === personaId ? { ...persona, ...updates } : persona))
        })),
      removePersona: (personaId) =>
        set((state) => ({
          personas: state.personas.filter((persona) => persona.id !== personaId),
          agencies: state.agencies.map((agency) => ({
            ...agency,
            participants: agency.participants.map((participant) =>
              participant.personaId === personaId ? { ...participant, personaId: undefined } : participant
            )
          }))
        })),
      addAgency: (agency) =>
        set((state) => {
          const exists = state.agencies.some((item) => item.id === agency.id);
          const agencies = exists
            ? state.agencies.map((item) => (item.id === agency.id ? { ...item, ...agency, updatedAt: agency.updatedAt } : item))
            : [agency, ...state.agencies];
          return { agencies, activeAgencyId: agency.id };
        }),
      updateAgency: (agencyId, updates) =>
        set((state) => ({
          agencies: state.agencies.map((agency) =>
            agency.id === agencyId
              ? {
                  ...agency,
                  ...updates,
                  updatedAt: new Date().toISOString()
                }
              : agency
          )
        })),
      removeAgency: (agencyId) =>
        set((state) => ({
          agencies: state.agencies.filter((agency) => agency.id !== agencyId),
          activeAgencyId: state.activeAgencyId === agencyId ? null : state.activeAgencyId
        })),
      setActiveAgency: (agencyId) => set({ activeAgencyId: agencyId }),
      setPersonaFilters: (filters) =>
        set((state) => ({
          personaFilters: {
            ...state.personaFilters,
            ...filters,
            capabilities: filters.capabilities
              ? Array.from(new Set(filters.capabilities.map((cap) => cap.trim()).filter(Boolean)))
              : state.personaFilters.capabilities
          }
        })),
      applyAgencySnapshot: (agency) =>
        set((state) => ({
          agencySessions: {
            ...state.agencySessions,
            [agency.agencyId]: agency
          },
          agencies: state.agencies.map((definition) =>
            definition.id === agency.agencyId
              ? {
                  ...definition,
                  updatedAt: new Date().toISOString()
                }
              : definition
          )
        })),
      applyWorkflowSnapshot: (workflow) =>
        set((state) => ({
          workflowSnapshots: {
            ...state.workflowSnapshots,
            [workflow.workflowId]: workflow
          }
        })),
      removeWorkflowSnapshot: (workflowId) =>
        set((state) => {
          const next = { ...state.workflowSnapshots };
          delete next[workflowId];
          return { workflowSnapshots: next };
        }),
      clearWorkflowSnapshots: () => set(() => ({ workflowSnapshots: {} }))
    }),
    {
      name: "agentos-client-state",
      storage: persistedStorage,
      partialize: (state) => ({
        personas: state.personas,
        agencies: state.agencies,
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        activeAgencyId: state.activeAgencyId,
        personaFilters: state.personaFilters,
        workflowSnapshots: state.workflowSnapshots,
        agencySessions: state.agencySessions
      })
    }
  )
);
