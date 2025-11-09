import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, ShieldOff, Save, Trash2 } from "lucide-react";
import { secretDefinitions } from "@/lib/secretCatalog";
import { useSecretStore } from "@/state/secretStore";

export function SecretManager() {
  const { t } = useTranslation();
  const secrets = useSecretStore((state) => state.secrets);
  const upsertSecret = useSecretStore((state) => state.upsertSecret);
  const removeSecret = useSecretStore((state) => state.removeSecret);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const handleChange = (id: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = (id: string) => {
    const value = drafts[id]?.trim();
    if (!value) {
      removeSecret(id);
    } else {
      upsertSecret(id, value);
    }
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <section
      className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-slate-100 dark:border-white/5"
      aria-label={t("secretManager.sectionLabel", { defaultValue: "Credentials & API Keys" })}
    >
      <header className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">
          {t("secretManager.title", { defaultValue: "Credentials" })}
        </p>
        <h3 className="text-lg font-semibold text-white">
          {t("secretManager.subtitle", { defaultValue: "API keys & plugin secrets" })}
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          {t("secretManager.helpText", {
            defaultValue: "Values are stored locally in your browser and sent only with your requests."
          })}
        </p>
      </header>

      <div className="space-y-4">
        {secretDefinitions.map((definition) => {
          const configured = Boolean(secrets[definition.id]);
          const lastUpdated = secrets[definition.id]?.updatedAt
            ? new Date(secrets[definition.id]!.updatedAt).toLocaleString()
            : undefined;
          const draftValue = drafts[definition.id] ?? "";

          return (
            <div key={definition.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{definition.label}</p>
                  <p className="text-xs text-slate-400">{definition.description}</p>
                  {definition.docsUrl && (
                    <a
                      href={definition.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-300 underline"
                    >
                      {t("secretManager.docsLink", { defaultValue: "Docs" })}
                    </a>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${
                    configured
                      ? "bg-emerald-500/10 text-emerald-200 border border-emerald-500/40"
                      : "bg-rose-500/10 text-rose-200 border border-rose-500/40"
                  }`}
                >
                  {configured ? (
                    <>
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      {t("secretManager.status.configured", { defaultValue: "Configured" })}
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-3 w-3" aria-hidden="true" />
                      {t("secretManager.status.missing", { defaultValue: "Missing" })}
                    </>
                  )}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                <label className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
                  {t("secretManager.inputLabel", { defaultValue: "Secret value" })}
                  <input
                    type="password"
                    placeholder={t("secretManager.placeholder", { defaultValue: "sk-..." })}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                    value={draftValue}
                    onChange={(event) => handleChange(definition.id, event.target.value)}
                    autoComplete="off"
                  />
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow shadow-sky-500/30 transition hover:bg-sky-600"
                    onClick={() => handleSave(definition.id)}
                  >
                    <Save className="h-3 w-3" aria-hidden="true" />
                    {t("secretManager.actions.save", { defaultValue: "Save" })}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200"
                    onClick={() => removeSecret(definition.id)}
                    disabled={!configured && !draftValue}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    {t("secretManager.actions.clear", { defaultValue: "Clear" })}
                  </button>
                  {lastUpdated && (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {t("secretManager.lastUpdated", { defaultValue: "Updated" })}: {lastUpdated}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
