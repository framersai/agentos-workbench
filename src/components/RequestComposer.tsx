import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Play, Users, ChevronDown, ChevronUp, AlertCircle, Lock } from "lucide-react";
import { EXAMPLE_PROMPTS, AGENCY_EXAMPLE_PROMPTS } from "@/constants/examplePrompts";
import { useTranslation } from "react-i18next";
import { useWorkflowDefinitions } from "@/hooks/useWorkflowDefinitions";
import { useSessionStore } from "@/state/sessionStore";
import { agentOSConfig } from "@/lib/env";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const createRequestSchema = (t: Translate) =>
  z.object({
    input: z.string().min(1, t("requestComposer.validation.inputRequired")),
    workflowId: z.string().optional()
  });

export type RequestComposerPayload = z.infer<ReturnType<typeof createRequestSchema>>;

interface RequestComposerProps {
  onSubmit: (payload: RequestComposerPayload) => void;
  disabled?: boolean;
}

export function RequestComposer({ onSubmit, disabled = false }: RequestComposerProps) {
  const { t } = useTranslation();
  const [isStreaming, setStreaming] = useState(false);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const { data: workflowDefinitions = [] } = useWorkflowDefinitions();

  const activeSession = sessions.find((item) => item.id === activeSessionId) ?? null;


  const samplePrompt = t("requestComposer.defaults.samplePrompt");
  const examplePrompts = useMemo(() => {
    // Use agency-specific prompts if agency session is active
    const source = activeSession?.targetType === 'agency' ? AGENCY_EXAMPLE_PROMPTS : EXAMPLE_PROMPTS;
    const arr = [...source];
    // Fisher-Yates shuffle (partial is fine)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const count = Math.random() < 0.5 ? 3 : 4;
    return arr.slice(0, count);
  }, [activeSession?.targetType]);
  const requestSchema = useMemo(() => createRequestSchema(t), [t]);

  const form = useForm<RequestComposerPayload>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      input: examplePrompts[0] || samplePrompt || "Hi"
    }
  });

  const { errors } = form.formState;

  // Remove all the complex form logic - session determines the target

  useEffect(() => {
    if (isStreaming && activeSession && activeSession.status !== "streaming") {
      setStreaming(false);
    }
  }, [activeSession, isStreaming]);

  // Remove unused options - session determines target

  const processSubmission = (values: RequestComposerPayload) => {
    if (!activeSession) {
      console.error("No active session selected");
      return;
    }

    setStreaming(true);
    onSubmit(values);
    form.setValue("input", "");
    const promptSource = activeSession.targetType === "agency" ? AGENCY_EXAMPLE_PROMPTS : EXAMPLE_PROMPTS;
    const nextPrompt = promptSource[Math.floor(Math.random() * promptSource.length)];
    setTimeout(() => form.setValue("input", nextPrompt), 100);
  };

  const handleSubmit = form.handleSubmit(processSubmission);

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900/60" data-tour="composer">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{t("requestComposer.header.title")}</p>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t("requestComposer.header.subtitle")}</h2>
      </header>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4" aria-busy={isStreaming} aria-live="polite">
        <fieldset disabled={isStreaming || disabled}>
        {/* Single Action Constraint Info */}
        {isStreaming && activeSession && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Single Action Mode Active</p>
              <p className="mt-0.5 text-[11px] opacity-90">
                Persona sessions intentionally process one request at a time. Launch an Agency session when you need concurrent seats
                or parallel workflows.
              </p>
            </div>
          </div>
        )}
        
        {/* Session Info Display */}
        {activeSession && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {activeSession.targetType === 'agency' ? 'Agency Session' : 'Persona Session'}
                </p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{activeSession.displayName}</p>
              </div>
              {activeSession.targetType === 'agency' && (
                <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              )}
            </div>
            {activeSession.targetType === 'agency' && workflowDefinitions.length > 0 && (
              <label className="mt-3 block space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Workflow (optional)</span>
                <select
                  {...form.register("workflowId")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100"
                >
                  <option value="">No workflow</option>
                  {workflowDefinitions.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <label className="flex flex-1 flex-col space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {t("requestComposer.form.userInput.label")}
          {examplePrompts.length > 0 && (
            <div className="flex flex-wrap gap-x-1 gap-y-1 text-[10px] leading-tight text-slate-600 dark:text-slate-400">
              {examplePrompts.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="rounded-full border border-slate-200 px-2 py-0 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-slate-900"
                  onClick={() => form.setValue('input', ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
          <textarea
            rows={6}
            {...form.register("input")}
            onKeyDown={(e) => {
              if (isStreaming) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void form.handleSubmit(processSubmission)();
              }
            }}
            className="flex-1 min-h-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {errors.input && (
            <p className="text-xs text-rose-600 dark:text-rose-300">{errors.input.message}</p>
          )}
        </label>



        <div className="mt-auto flex flex-col gap-3 text-xs text-slate-600 dark:text-slate-400">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5"
            disabled={isStreaming}
          >
            <Play className="h-4 w-4" />
            {isStreaming ? t("requestComposer.actions.streaming") : t("requestComposer.actions.submit")}
          </button>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setShowConnectionDetails(!showConnectionDetails)}
              className="flex items-start gap-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            >
              <AlertCircle className="mt-0.5 h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span>{t("requestComposer.footer.localNotice")}</span>
              {showConnectionDetails ? (
                <ChevronUp className="mt-0.5 h-3 w-3" />
              ) : (
                <ChevronDown className="mt-0.5 h-3 w-3" />
              )}
            </button>
            {showConnectionDetails && (
              <div className="ml-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-400">
                <p className="mb-2 font-semibold">Connection Status</p>
                <p className="mb-2">{t("requestComposer.footer.localNoticeDetails")}</p>
                <div className="mt-2 space-y-1 font-mono text-[10px]">
                  <div>
                    <span className="text-slate-500 dark:text-slate-500">API Endpoint:</span>{" "}
                    <span className="text-slate-700 dark:text-slate-300">{agentOSConfig.baseUrl}{agentOSConfig.streamPath}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-500">Storage:</span>{" "}
                    <span className="text-slate-700 dark:text-slate-300">IndexedDB (browser local)</span>
                  </div>
                </div>
                <p className="mt-2 text-amber-700 dark:text-amber-400">
                  ⚠️ If requests fail, ensure your backend is running with <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">AGENTOS_ENABLED=true</code>
                </p>
              </div>
            )}
          </div>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
