import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SkipLink } from "@/components/SkipLink";
import { Sidebar } from "@/components/Sidebar";
import { SessionInspector } from "@/components/SessionInspector";
import { RequestComposer, type RequestComposerPayload } from "@/components/RequestComposer";
import { AgencyManager } from "@/components/AgencyManager";
import { PersonaCatalog } from "@/components/PersonaCatalog";
import { WorkflowOverview } from "@/components/WorkflowOverview";
import { openAgentOSStream } from "@/lib/agentosClient";
import { usePersonas } from "@/hooks/usePersonas";
import { useSystemTheme } from "@/hooks/useSystemTheme";
import { useSessionStore } from "@/state/sessionStore";
import {
  AgentOSChunkType,
  type AgentOSAgencyUpdateChunk,
  type AgentOSWorkflowUpdateChunk
} from "@/types/agentos";

const DEFAULT_PERSONA_ID = "voice_assistant_persona";

export default function App() {
  const { t } = useTranslation();
  const personas = useSessionStore((state) => state.personas);
  const agencies = useSessionStore((state) => state.agencies);
  const applyAgencySnapshot = useSessionStore((state) => state.applyAgencySnapshot);
  const applyWorkflowSnapshot = useSessionStore((state) => state.applyWorkflowSnapshot);
  const setPersonas = useSessionStore((state) => state.setPersonas);
  const personaFilters = useSessionStore((state) => state.personaFilters);
  const upsertSession = useSessionStore((state) => state.upsertSession);
  const appendEvent = useSessionStore((state) => state.appendEvent);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

  const streamHandles = useRef<Record<string, () => void>>({});
  const personasQuery = usePersonas({
    filters: {
      search: personaFilters.search.trim() ? personaFilters.search.trim() : undefined,
      capability: personaFilters.capabilities
    }
  });

  useEffect(() => {
    if (!personasQuery.data || personasQuery.data.length === 0) {
      return;
    }
    setPersonas(personasQuery.data);
  }, [personasQuery.data, setPersonas]);

  useEffect(() => {
    if (personasQuery.error) {
      console.error("[AgentOS Client] Failed to load personas", personasQuery.error);
    }
  }, [personasQuery.error]);


  const resolvePersonaName = useCallback(
    (personaId?: string | null) => {
      if (!personaId) {
        return t("app.fallbacks.untitledPersona");
      }
      const persona = personas.find((item) => item.id === personaId);
      return persona?.displayName ?? personaId;
    },
    [personas, t]
  );

  const resolveAgencyName = useCallback(
    (agencyId?: string | null) => {
      if (!agencyId) {
        return t("app.fallbacks.agencyCollective");
      }
      const agency = agencies.find((item) => item.id === agencyId);
      return agency?.name ?? agencyId;
    },
    [agencies, t]
  );

  const ensureSession = useCallback(
    (payload: RequestComposerPayload) => {
      const sessionId = activeSessionId ?? crypto.randomUUID();
      if (!activeSessionId) {
        upsertSession({
          id: sessionId,
          targetType: payload.targetType,
          displayName:
            payload.targetType === "agency"
              ? resolveAgencyName(payload.agencyId)
              : resolvePersonaName(payload.personaId),
          personaId: payload.targetType === "persona" ? payload.personaId : undefined,
          agencyId: payload.targetType === "agency" ? payload.agencyId : undefined,
          status: "idle",
          events: []
        });
        setActiveSession(sessionId);
      }
      return sessionId;
    },
    [activeSessionId, resolveAgencyName, resolvePersonaName, setActiveSession, upsertSession]
  );

  const handleCreateSession = useCallback(() => {
    const sessionId = crypto.randomUUID();
    const hasAgencies = agencies.length > 0;
    const personaId = personas[0]?.id;
    const agencyId = agencies[0]?.id;
    upsertSession({
      id: sessionId,
      targetType: hasAgencies ? "agency" : "persona",
      displayName: hasAgencies ? resolveAgencyName(agencyId) : resolvePersonaName(personaId),
      personaId: hasAgencies ? undefined : personaId,
      agencyId: hasAgencies ? agencyId : undefined,
      status: "idle",
      events: []
    });
    setActiveSession(sessionId);
  }, [agencies, personas, resolveAgencyName, resolvePersonaName, setActiveSession, upsertSession]);

  const handleSubmit = useCallback(
    (payload: RequestComposerPayload) => {
      const sessionId = ensureSession(payload);
      setActiveSession(sessionId);

      streamHandles.current[sessionId]?.();
      delete streamHandles.current[sessionId];

      const displayName =
        payload.targetType === "agency" ? resolveAgencyName(payload.agencyId) : resolvePersonaName(payload.personaId);
      const timestamp = Date.now();

      const agencyDefinition =
        payload.targetType === "agency" ? agencies.find((item) => item.id === payload.agencyId) ?? null : null;

      const fallbackPersonaId = personas[0]?.id ?? DEFAULT_PERSONA_ID;

      const personaForStream =
        payload.targetType === "agency"
          ? agencyDefinition?.participants[0]?.personaId ?? payload.personaId ?? fallbackPersonaId
          : payload.personaId ?? fallbackPersonaId;

      const workflowDefinitionId = payload.workflowId ?? agencyDefinition?.workflowId;
      const workflowInstanceId = workflowDefinitionId ? `${workflowDefinitionId}-${sessionId}` : undefined;

      const agencyRequest = payload.targetType === "agency"
        ? {
            agencyId: payload.agencyId,
            workflowId: workflowInstanceId ?? undefined,
            goal: agencyDefinition?.goal,
            participants: (agencyDefinition?.participants ?? []).map((participant) => ({
              roleId: participant.roleId,
              personaId: participant.personaId
            })),
            metadata: agencyDefinition?.metadata
          }
        : undefined;

      const workflowRequest = workflowDefinitionId
        ? {
            definitionId: workflowDefinitionId,
            workflowId: workflowInstanceId,
            conversationId: sessionId,
            metadata: { source: "agentos-client" }
          }
        : undefined;

      upsertSession({
        id: sessionId,
        targetType: payload.targetType,
        displayName,
        personaId: payload.targetType === "persona" ? payload.personaId : undefined,
        agencyId: payload.targetType === "agency" ? payload.agencyId : undefined,
        status: "streaming"
      });

      appendEvent(sessionId, {
        id: crypto.randomUUID(),
        timestamp,
        type: "log",
        payload: {
          message: t("app.logs.userMessage", { displayName, content: payload.input })
        }
      });

      const cleanup = openAgentOSStream(
        {
          sessionId,
          personaId: personaForStream,
          messages: [{ role: "user", content: payload.input }],
          workflowRequest,
          agencyRequest
        },
        {
          onChunk: (chunk) => {
            appendEvent(sessionId, {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              type: chunk.type,
              payload: chunk
            });

            if (chunk.type === AgentOSChunkType.AGENCY_UPDATE) {
              applyAgencySnapshot((chunk as AgentOSAgencyUpdateChunk).agency);
            }

            if (chunk.type === AgentOSChunkType.WORKFLOW_UPDATE) {
              applyWorkflowSnapshot((chunk as AgentOSWorkflowUpdateChunk).workflow);
            }
          },
          onDone: () => {
            upsertSession({ id: sessionId, status: "idle" });
            delete streamHandles.current[sessionId];
          },
          onError: (error) => {
            appendEvent(sessionId, {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              type: "log",
              payload: { message: t("app.logs.streamError", { message: error.message }), level: "error" }
            });
            upsertSession({ id: sessionId, status: "error" });
            delete streamHandles.current[sessionId];
          }
        }
      );

      streamHandles.current[sessionId] = cleanup;
    },
    [agencies, personas, appendEvent, applyAgencySnapshot, applyWorkflowSnapshot, ensureSession, resolveAgencyName, resolvePersonaName, setActiveSession, upsertSession]
  );

  return (
    <>
      <SkipLink />
      <div className="grid h-screen w-full grid-cols-panel bg-slate-50 text-slate-900 transition-colors duration-300 ease-out dark:bg-slate-950 dark:text-slate-100">
        {/* Navigation Sidebar */}
        <Sidebar onCreateSession={handleCreateSession} />
        
        {/* Main Content Area */}
        <main 
          id="main-content"
          className="flex flex-col gap-6 overflow-hidden bg-white p-6 transition-colors duration-300 dark:bg-slate-950"
          role="main"
          aria-label={t("app.labels.mainContent", { defaultValue: "Main content area" })}
        >
          <div className="grid flex-1 grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
            {/* Primary Panel: Session Inspector */}
            <section aria-labelledby="session-inspector-title">
              <SessionInspector />
            </section>
            
            {/* Secondary Panel: Controls and Information */}
            <aside 
              className="flex h-full flex-col gap-6"
              aria-label={t("app.labels.controlPanel", { defaultValue: "Control panel and information" })}
            >
              <RequestComposer onSubmit={handleSubmit} />
              <AgencyManager />
              <WorkflowOverview />
              <PersonaCatalog />
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}
