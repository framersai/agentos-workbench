import { clsx } from "clsx";
import { Radio, Plus, CheckCircle2, Users, Github, GitFork, Star, Globe, Store, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useSessionStore } from "@/state/sessionStore";
import { AgentOSChunkType } from "@/types/agentos";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface SidebarProps {
  onCreateSession: (opts?: { targetType?: 'persona' | 'agency'; personaId?: string; agencyId?: string; displayName?: string }) => void;
  onToggleCollapse?: () => void;
  onNavigate?: (key: 'compose' | 'agency' | 'personas' | 'workflows' | 'settings' | 'about') => void;
}

const statusBadgeStyles: Record<string, string> = {
  idle: "bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  streaming: "bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  error: "bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30"
};

export function Sidebar({ onCreateSession, onToggleCollapse, onNavigate }: SidebarProps) {
  const { t } = useTranslation();
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const personas = useSessionStore((state) => state.personas);
  const agencies = useSessionStore((state) => state.agencies);
  const [filter, setFilter] = useState<'all' | 'persona' | 'agency'>('persona');
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState<'persona' | 'agency'>('persona');

  const preferDefaultPersona = useCallback((ids: string[]): string | undefined => {
    if (ids.includes('v_researcher')) return 'v_researcher';
    if (ids.includes('nerf_generalist')) return 'nerf_generalist';
    return ids[0];
  }, []);
  const remotePersonaIds = useMemo(() => personas.filter(p => p.source === 'remote').map(p => p.id), [personas]);
  const defaultPersonaId = preferDefaultPersona(remotePersonaIds) ?? personas[0]?.id ?? "";
  const defaultAgencyId = agencies[0]?.id ?? "";
  const [newPersonaId, setNewPersonaId] = useState<string>(defaultPersonaId);
  const [newAgencyId, setNewAgencyId] = useState<string>(defaultAgencyId);
  const [newName, setNewName] = useState<string>("");

  useEffect(() => {
    if (!newPersonaId && defaultPersonaId) {
      setNewPersonaId(defaultPersonaId);
    }
  }, [defaultPersonaId, newPersonaId]);

  useEffect(() => {
    if (!newAgencyId && defaultAgencyId) {
      setNewAgencyId(defaultAgencyId);
    }
  }, [defaultAgencyId, newAgencyId]);

  const personaOptionsAvailable = personas.length > 0;
  const agencyOptionsAvailable = agencies.length > 0;
  const canCreateSession =
    (newType === 'persona' && personaOptionsAvailable && Boolean(newPersonaId)) ||
    (newType === 'agency' && agencyOptionsAvailable && Boolean(newAgencyId));

  const openNew = () => {
    const nextType: 'persona' | 'agency' = filter === 'agency' ? 'agency' : 'persona';
    setNewType(nextType);
    if (nextType === 'agency') {
      setNewAgencyId(defaultAgencyId);
    } else {
      setNewPersonaId(defaultPersonaId);
    }
    setNewName("");
    setShowNew(true);
  };

  const createNew = () => {
    if (!canCreateSession) {
      return;
    }

    const displayName = newName.trim() || undefined;
    if (newType === 'agency') {
      const agencyId = newAgencyId || defaultAgencyId;
      if (!agencyId) {
        return;
      }
      onCreateSession({ targetType: 'agency', agencyId, displayName });
    } else {
      const personaId = newPersonaId || defaultPersonaId;
      if (!personaId) {
        return;
      }
      onCreateSession({ targetType: 'persona', personaId, displayName });
    }
    setFilter(newType);
    setShowNew(false);
    setNewName("");
    setNewPersonaId(defaultPersonaId);
    setNewAgencyId(defaultAgencyId);
  };

  const sortedSessions = useMemo(() => {
    const base = [...sessions];
    const filtered = filter === 'all' ? base : base.filter((s) => s.targetType === filter);
    return filtered.sort((a, b) => {
      const latestA = a.events[0]?.timestamp ?? 0;
      const latestB = b.events[0]?.timestamp ?? 0;
      return latestB - latestA;
    });
  }, [sessions, filter]);

  // Switch session timeline when filter changes
  const handleFilterChange = (newFilter: 'all' | 'persona' | 'agency') => {
    setFilter(newFilter);
    // Auto-switch to first session of the new type
    const filtered = newFilter === 'all' ? sessions : sessions.filter((s) => s.targetType === newFilter);
    if (filtered.length > 0 && filtered[0].id !== activeSessionId) {
      setActiveSession(filtered[0].id);
    }
  };

  return (
    <nav 
      className="flex h-full flex-col border-r border-slate-200 bg-slate-50 text-[0.93rem] transition-colors dark:border-white/5 dark:bg-slate-950/60"
      aria-label={t("sidebar.labels.navigation", { defaultValue: "Session navigation" })}
    >
      {/* Header with branding and controls */}
      <header className="flex flex-shrink-0 flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/5">
        <div className="flex items-center gap-1">
          <span className="whitespace-nowrap text-[5px] font-medium uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">WORKBENCH</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-sky-600 dark:text-sky-400">Agent Sessions</p>
            <h1 className="sr-only">{t("sidebar.title")}</h1>
          </div>
          <button
            onClick={openNew}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
            title={t("sidebar.actions.newSession")}
            aria-label={t("sidebar.actions.newSession")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="ml-2 rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-600 transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
              title="Hide sidebar"
              aria-label="Hide sidebar"
            >
              ◀
            </button>
          )}
        </div>
        
        {/* Quick links (Settings/About) and actions (Tour/Theme/Import) */}
        <div className="mt-2 flex flex-wrap items-center gap-2" role="navigation" aria-label="Quick links">
          <button onClick={() => window.dispatchEvent(new CustomEvent('agentos:open-settings'))} className={clsx('rounded-full border px-3 py-1 text-[10px] transition', 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300')}>Settings</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('agentos:open-about'))} className={clsx('rounded-full border px-3 py-1 text-[10px] transition', 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300')}>About</button>
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
          <button onClick={() => window.dispatchEvent(new CustomEvent('agentos:toggle-tour'))} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Tour</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('agentos:toggle-theme-panel'))} className="rounded-full border border-slate-200 px-3 py-1 text-[10px] text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200">Theme</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('agentos:open-import'))} className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[10px] text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">Import</button>
        </div>

        {/* Language Control */}
        <div className="flex items-center justify-between gap-2" role="toolbar" aria-label={t("sidebar.labels.preferences", { defaultValue: "Preferences" })}>
          <LanguageSwitcher />
        </div>
      </header>
      
      {/* Filter + Session List */}
      <div 
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-8 pt-4"
        role="list"
        aria-label={t("sidebar.labels.sessionList", { defaultValue: "Active sessions" })}
      >
        <div className="mb-2 flex items-center gap-2 text-xs">
          <button onClick={() => handleFilterChange('all')} className={clsx('rounded-full border px-2 py-0.5', filter === 'all' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300')}>All</button>
          <button onClick={() => handleFilterChange('persona')} className={clsx('rounded-full border px-2 py-0.5', filter === 'persona' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300')}>Persona</button>
          <button onClick={() => handleFilterChange('agency')} className={clsx('rounded-full border px-2 py-0.5', filter === 'agency' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300')}>Agency</button>
        </div>
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
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
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
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <header className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New session</h3>
            </header>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={newType==='persona'}
                    onChange={() => {
                      setNewType('persona');
                      setNewPersonaId(defaultPersonaId);
                    }}
                  />
                  <span>Persona</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={newType==='agency'}
                    onChange={() => {
                      setNewType('agency');
                      setNewAgencyId(defaultAgencyId);
                    }}
                    disabled={!agencyOptionsAvailable}
                  />
                  <span className={!agencyOptionsAvailable ? "text-slate-400" : undefined}>Agency</span>
                </label>
              </div>
              {newType === 'persona' ? (
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Persona</span>
                  {personaOptionsAvailable ? (
                    <select
                      value={newPersonaId}
                      onChange={(e)=>setNewPersonaId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
                    >
                      {[...personas].map(p => (
                        <option key={p.id} value={p.id}>{p.displayName}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      No personas available. Create or import one from the Personas tab.
                    </p>
                  )}
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Agency</span>
                  {agencyOptionsAvailable ? (
                    <div className="space-y-2">
                      <select
                        value={newAgencyId}
                        onChange={(e)=>setNewAgencyId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
                      >
                        {[...agencies].map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNew(false);
                          window.dispatchEvent(new CustomEvent('agentos:open-agency-wizard'));
                        }}
                        className="inline-flex items-center gap-2 text-xs text-slate-500 underline decoration-dotted hover:text-slate-700 dark:text-slate-300"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                        Launch agency wizard
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      <p>No agencies have been defined yet.</p>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate?.('agency');
                          setShowNew(false);
                        }}
                        className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500"
                      >
                        Open Agency Manager
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNew(false);
                          window.dispatchEvent(new CustomEvent('agentos:open-agency-wizard'));
                        }}
                        className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-400"
                      >
                        Launch Wizard
                      </button>
                    </div>
                  )}
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Name (optional)</span>
                <input value={newName} onChange={(e)=>setNewName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setShowNew(false)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">Cancel</button>
              <button
                onClick={createNew}
                disabled={!canCreateSession}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  canCreateSession
                    ? "bg-sky-500 text-white hover:bg-sky-400"
                    : "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-500"
                )}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Footer links */}
      <footer className="mt-auto border-t border-slate-200 px-5 py-3 text-xs text-slate-600 dark:border-white/5 dark:text-slate-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a
            href="https://vca.chat"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sky-600 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:text-sky-300 dark:hover:bg-slate-900/50 dark:focus-visible:ring-offset-slate-950"
          >
            <Store className="h-4 w-4 transition-transform group-hover:scale-110" aria-hidden="true" />
            <span className="uppercase tracking-[0.35em]">Marketplace</span>
          </a>
          <div className="flex items-center gap-2 pr-4">
            <a
              href="https://agentos.sh"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 rounded-md px-2 py-1 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:hover:bg-slate-900/50 dark:focus-visible:ring-offset-slate-950"
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">agentos.sh</span>
            </a>
            <a
              href="https://frame.dev"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 rounded-md px-2 py-1 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:hover:bg-slate-900/50 dark:focus-visible:ring-offset-slate-950"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">frame.dev</span>
            </a>
            <a
              href="https://github.com/framersai/agentos"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 rounded-md px-2 py-1 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:hover:bg-slate-900/50 dark:focus-visible:ring-offset-slate-950"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a
              href="https://github.com/framersai/agentos/stargazers"
              target="_blank"
              rel="noreferrer"
              aria-label="Star AgentOS on GitHub"
              className="group inline-flex items-center rounded-full p-1 pr-2 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-yellow-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 dark:hover:bg-yellow-950/30 dark:focus-visible:ring-offset-slate-950"
            >
              <Star className="h-4 w-4 text-yellow-500 transition-transform group-active:scale-90" aria-hidden="true" />
            </a>
            <a
              href="https://github.com/framersai/agentos/fork"
              target="_blank"
              rel="noreferrer"
              aria-label="Fork AgentOS on GitHub"
              className="group inline-flex items-center rounded-full p-1 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:hover:bg-slate-900/50 dark:focus-visible:ring-offset-slate-950"
            >
              <GitFork className="h-4 w-4 transition-transform group-active:scale-90" aria-hidden="true" />
            </a>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="ml-auto rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-white/10 dark:text-slate-300 dark:focus-visible:ring-offset-slate-950"
              title="Hide sidebar"
            >
              Hide
            </button>
          )}
        </div>
      </footer>
    </nav>
  );
}
