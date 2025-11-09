import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Paperclip, Play, Sparkle, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkflowDefinitions } from "@/hooks/useWorkflowDefinitions";
import { useSessionStore, type SessionTargetType } from "@/state/sessionStore";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const createRequestSchema = (t: Translate) =>
  z
    .object({
      targetType: z.enum(["persona", "agency"]),
      personaId: z.string().optional(),
      agencyId: z.string().optional(),
      input: z.string().min(1, t("requestComposer.validation.inputRequired")),
      mode: z.enum(["chat", "voice"]),
      workflowId: z.string().optional()
    })
    .superRefine((data, ctx) => {
      if (data.targetType === "persona" && !data.personaId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("requestComposer.validation.selectPersona"), path: ["personaId"] });
      }
      if (data.targetType === "agency" && !data.agencyId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("requestComposer.validation.selectAgency"), path: ["agencyId"] });
      }
    });

export type RequestComposerPayload = z.infer<ReturnType<typeof createRequestSchema>>;

interface RequestComposerProps {
  onSubmit: (payload: RequestComposerPayload) => void;
}

export function RequestComposer({ onSubmit }: RequestComposerProps) {
  const { t } = useTranslation();
  const [isStreaming, setStreaming] = useState(false);
  const personas = useSessionStore((state) => state.personas);
  const agencies = useSessionStore((state) => state.agencies);
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeAgencyId = useSessionStore((state) => state.activeAgencyId);
  const setActiveAgency = useSessionStore((state) => state.setActiveAgency);
  const { data: workflowDefinitions = [], isLoading: workflowsLoading } = useWorkflowDefinitions();

  const activeSession = sessions.find((item) => item.id === activeSessionId) ?? null;

  const defaultPersonaId = personas[0]?.id ?? "";
  const fallbackAgencyId = agencies[0]?.id ?? "";
  const defaultAgencyId = activeAgencyId ?? fallbackAgencyId;
  const initialTarget: SessionTargetType = agencies.length > 0 ? "agency" : "persona";

  const samplePrompt = t("requestComposer.defaults.samplePrompt");
  const replayPrompt = t("requestComposer.actions.replayPlaceholder");
  const requestSchema = useMemo(() => createRequestSchema(t), [t]);
  const targetOptions = useMemo(
    () => [
      { value: "persona" as const, label: t("requestComposer.targetOptions.persona") },
      { value: "agency" as const, label: t("requestComposer.targetOptions.agency") }
    ],
    [t]
  );
  const modeOptions = useMemo(
    () => [
      { value: "chat" as const, label: t("requestComposer.modes.chat") },
      { value: "voice" as const, label: t("requestComposer.modes.voice") }
    ],
    [t]
  );

  const form = useForm<RequestComposerPayload>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      targetType: initialTarget,
      personaId: initialTarget === "persona" ? defaultPersonaId : undefined,
      agencyId: initialTarget === "agency" ? defaultAgencyId : undefined,
      input: samplePrompt,
      mode: "chat"
    }
  });

  const targetType = form.watch("targetType");
  const personaId = form.watch("personaId");
  const agencyId = form.watch("agencyId");
  const workflowId = form.watch("workflowId");
  const { errors } = form.formState;

  useEffect(() => {
    if (targetType === "persona" && !personaId && personas[0]) {
      form.setValue("personaId", personas[0].id, { shouldValidate: true });
    }
    if (targetType === "agency" && (!agencyId || !agencies.some((item) => item.id === agencyId))) {
      const fallback = activeAgencyId ?? agencies[0]?.id;
      if (fallback) {
        form.setValue("agencyId", fallback, { shouldValidate: true });
      }
    }
  }, [targetType, personaId, agencyId, personas, agencies, activeAgencyId, form]);

  useEffect(() => {
    if (targetType === "agency" && agencyId) {
      setActiveAgency(agencyId);
    }
  }, [targetType, agencyId, setActiveAgency]);

  useEffect(() => {
    if (personas.length === 0 && targetType === "persona") {
      form.setValue("targetType", "agency");
    }
  }, [personas, targetType, form]);

  useEffect(() => {
    if (agencies.length === 0 && targetType === "agency") {
      form.setValue("targetType", "persona");
    }
  }, [agencies, targetType, form]);

  useEffect(() => {
    if (targetType === "agency" && !workflowId && workflowDefinitions.length > 0) {
      form.setValue("workflowId", workflowDefinitions[0].id, { shouldValidate: false });
    }
  }, [targetType, workflowId, workflowDefinitions, form]);

  useEffect(() => {
    if (targetType === "agency" && agencyId) {
      const matchingAgency = agencies.find((agency) => agency.id === agencyId);
      if (matchingAgency?.workflowId && matchingAgency.workflowId !== form.getValues("workflowId")) {
        form.setValue("workflowId", matchingAgency.workflowId, { shouldValidate: false });
      }
    }
  }, [agencies, agencyId, form, targetType]);

  useEffect(() => {
    if (isStreaming && activeSession && activeSession.status !== "streaming") {
      setStreaming(false);
    }
  }, [activeSession, isStreaming]);

  const personaOptions = useMemo(
    () =>
      personas.map((persona) => ({
        id: persona.id,
        label: persona.displayName
      })),
    [personas]
  );

  const agencyOptions = useMemo(
    () =>
      agencies.map((agency) => ({
        id: agency.id,
        label: agency.name
      })),
    [agencies]
  );

  const workflowOptions = useMemo(
    () =>
      workflowDefinitions.map((definition) => ({
        id: definition.id,
        label: definition.displayName
      })),
    [workflowDefinitions]
  );

  const processSubmission = (values: RequestComposerPayload) => {
    setStreaming(true);
    if (values.targetType === "agency") {
      setActiveAgency(values.agencyId ?? null);
    }
    onSubmit(values);
  };

  const handleSubmit = form.handleSubmit(processSubmission);

  const handleReplay = () => {
    void form.handleSubmit((values) => processSubmission({ ...values, input: replayPrompt }))();
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/60 p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t("requestComposer.header.title")}</p>
        <h2 className="text-lg font-semibold text-slate-100">{t("requestComposer.header.subtitle")}</h2>
      </header>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        <fieldset className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <legend className="sr-only">{t("requestComposer.form.targetLegend")}</legend>
          {targetOptions.map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2">
              <input
                type="radio"
                value={option.value}
                {...form.register("targetType")}
                disabled={option.value === "agency" && agencies.length === 0}
                className="h-3 w-3 border-white/20 bg-slate-950 text-sky-500 focus:ring-sky-500 disabled:opacity-30"
              />
              <span className="uppercase">{option.label}</span>
            </label>
          ))}
          {agencies.length === 0 && (
            <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500">
              {t("requestComposer.guidance.createAgency")}
            </span>
          )}
        </fieldset>

        {targetType === "persona" ? (
          <label className="space-y-2 text-sm text-slate-300">
            {t("requestComposer.form.persona.label")}
            <select
              {...form.register("personaId")}
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              <option value="" disabled>
                {t("requestComposer.form.persona.placeholder")}
              </option>
              {personaOptions.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.label}
                </option>
              ))}
            </select>
            {errors.personaId && <p className="text-xs text-rose-300">{errors.personaId.message}</p>}
          </label>
        ) : (
          <div className="space-y-4">
            <label className="space-y-2 text-sm text-slate-300">
              {t("requestComposer.form.agency.label")}
              <select
                {...form.register("agencyId", {
                  onChange: (event) => setActiveAgency(event.target.value || null)
                })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="" disabled>
                  {t("requestComposer.form.agency.placeholder")}
                </option>
                {agencyOptions.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.label}
                  </option>
                ))}
              </select>
              {errors.agencyId && <p className="text-xs text-rose-300">{errors.agencyId.message}</p>}
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              {t("requestComposer.form.workflow.label")}
              <select
                {...form.register("workflowId")}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="">
                  {workflowsLoading ? t("requestComposer.form.workflow.loading") : t("requestComposer.form.workflow.none")}
                </option>
                {workflowOptions.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">{t("requestComposer.form.workflow.hint")}</p>
            </label>
          </div>
        )}

        <label className="flex flex-1 flex-col space-y-2 text-sm text-slate-300">
          {t("requestComposer.form.userInput.label")}
          <textarea
            rows={6}
            {...form.register("input")}
            className="flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <fieldset className="flex items-center gap-4 text-xs text-slate-400">
          <legend className="sr-only">{t("requestComposer.form.modeLegend")}</legend>
          {modeOptions.map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2">
              <input
                type="radio"
                value={option.value}
                {...form.register("mode")}
                className="h-3 w-3 border-white/20 bg-slate-950 text-sky-500 focus:ring-sky-500"
              />
              <span className="uppercase">{option.label}</span>
            </label>
          ))}
        </fieldset>

        {targetType === "agency" && (
          <p className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs text-sky-100">
            <Users className="h-3 w-3 text-sky-300" />
            {t("requestComposer.form.workflow.agencyNotice")}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3 text-xs text-slate-400">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5"
            disabled={isStreaming}
          >
            <Play className="h-4 w-4" />
            {isStreaming ? t("requestComposer.actions.streaming") : t("requestComposer.actions.submit")}
          </button>
          <button
            type="button"
            onClick={handleReplay}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-400/40"
            disabled={!activeSessionId}
          >
            <Paperclip className="h-4 w-4" /> {t("requestComposer.actions.attachTranscript")}
          </button>
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <Sparkle className="mt-0.5 h-3 w-3 text-sky-400" />
            {t("requestComposer.footer.localNotice")}
          </div>
        </div>
      </form>
    </div>
  );
}
