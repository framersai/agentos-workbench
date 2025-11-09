import { useMemo } from "react";
import { clsx } from "clsx";
import { Radio, Plus, CheckCircle2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/state/sessionStore";
import { AgentOSChunkType } from "@/types/agentos";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

interface SidebarProps {
  onCreateSession: () => void;
}

const statusBadgeStyles: Record<string, string> = {
  idle: "bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  streaming: "bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  error: "bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30"
};

export function Sidebar({ onCreateSession }: SidebarProps) {
  const { t } = useTranslation();
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const latestA = a.events[0]?.timestamp ?? 0;
      const latestB = b.events[0]?.timestamp ?? 0;
      return latestB - latestA;
    });
  }, [sessions]);

  return (
    <nav 
      className="flex h-full flex-col border-r border-slate-200 bg-slate-50 transition-colors dark:border-white/5 dark:bg-slate-950/60"
      aria-label={t("sidebar.labels.navigation", { defaultValue: "Session navigation" })}
    >
      {/* Header with branding and controls */}
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400">
              {t("sidebar.sessionsLabel")}
            </p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("sidebar.title")}
            </h1>
          </div>
          <button
            onClick={onCreateSession}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
            title={t("sidebar.actions.newSession")}
            aria-label={t("sidebar.actions.newSession")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        
        {/* Theme and Language Controls */}
        <div className="flex items-center justify-between gap-2" role="toolbar" aria-label={t("sidebar.labels.preferences", { defaultValue: "Preferences" })}>
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>
      
      {/* Session List */}
      <div 
        className="flex-1 space-y-2 overflow-y-auto px-4 pb-8 pt-4"
        role="list"
        aria-label={t("sidebar.labels.sessionList", { defaultValue: "Active sessions" })}
      >
        {sortedSessions.length === 0 ? (
          <div 
            className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-600 dark:border-white/5 dark:bg-slate-900/60 dark:text-slate-400"
            role="status"
          >
            {t("sidebar.emptyState")}
          </div>
        ) : (
          sortedSessions.map((session) => {
            const status = session.status;
            const statusLabel = t(`common.status.${status}` as const, { defaultValue: status });
            const isActive = activeSessionId === session.id;
            
            const targetBadge =
              session.targetType === "agency" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-sky-600 dark:text-sky-300">
                  <Users className="h-3 w-3" aria-hidden="true" /> {t("sidebar.badges.agency")}
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
                  {t("sidebar.badges.persona")}
                </span>
              );
              
            return (
              <button
                key={session.id}
                onClick={() => setActiveSession(session.id)}
                className={clsx(
                  "flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition",
                  "focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950",
                  isActive 
                    ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/60 dark:border-sky-500/60 dark:bg-slate-800" 
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/5 dark:bg-slate-900/40 dark:hover:border-white/10 dark:hover:bg-slate-900/60"
                )}
                role="listitem"
                aria-label={t("sidebar.session.ariaLabel", { 
                  defaultValue: "Session {{name}}, status: {{status}}", 
                  name: session.displayName, 
                  status: statusLabel 
                })}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    <Radio className="h-3 w-3 text-sky-500 dark:text-sky-400" aria-hidden="true" />
                    <span className="sr-only">{t("sidebar.session.streamLabel")}</span>
                  </span>
                  <span 
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
                      statusBadgeStyles[status]
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    {statusLabel}
                  </span>
                </div>
                
                {/* Session Info */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {session.displayName}
                    </p>
                    {targetBadge}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {session.events.length === 0
                      ? t("sidebar.session.noActivity")
                      : new Date(session.events[0]!.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                
                {/* Completion Indicator */}
                {session.events.find((event) => event.type === AgentOSChunkType.FINAL_RESPONSE) && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    <span>{t("sidebar.session.completedTurn")}</span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </nav>
  );
}
