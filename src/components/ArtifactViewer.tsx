import { useCallback, useMemo } from "react";
import { Clipboard, Download, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ArtifactViewerProps {
  result: unknown;
  label?: string;
}

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const isLikelyBase64 = (value: string): boolean => /^[A-Za-z0-9+/=]+$/.test(value) && value.length % 4 === 0;

export function ArtifactViewer({ result, label }: ArtifactViewerProps) {
  const { t } = useTranslation();
  const ensureString = (value: unknown): string | null => (typeof value === "string" ? value : null);

  const downloadInfo = useMemo(() => {
    if (typeof result !== "object" || result === null) {
      return null;
    }
    const maybe = result as { data?: string; mimeType?: string; filename?: string };
    if (typeof maybe.data === "string" && maybe.data.length > 0 && typeof maybe.mimeType === "string" && isLikelyBase64(maybe.data)) {
      return {
        blob: (typeof atob === "function" ? Uint8Array.from(atob(maybe.data), (char) => char.charCodeAt(0)) : new Uint8Array()),
        mimeType: maybe.mimeType,
        filename: maybe.filename ?? `artifact-${Date.now()}`
      };
    }
    return null;
  }, [result]);

  const handleCopy = useCallback(
    (value: string) => {
      void navigator.clipboard?.writeText(value).catch(() => void 0);
    },
    []
  );

  const handleDownload = useCallback(() => {
    if (!downloadInfo) {
      return;
    }
    const blob = new Blob([downloadInfo.blob], { type: downloadInfo.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadInfo.filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [downloadInfo]);

  const renderValue = (value: unknown): JSX.Element => {
    if (typeof value === "string") {
      if (isHttpUrl(value)) {
        return (
          <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:underline">
            <Link2 className="h-3 w-3" />
            {value}
          </a>
        );
      }
      if (value.includes("\n") || value.length > 160) {
        return <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/60 p-3 text-sm text-slate-100">{value}</pre>;
      }
      return <span className="text-sm text-slate-100">{value}</span>;
    }

    if (Array.isArray(value)) {
      return (
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
          {value.map((item, index) => (
            <li key={index}>{renderValue(item)}</li>
          ))}
        </ul>
      );
    }

    if (value && typeof value === "object") {
      const maybeUrl = ensureString((value as Record<string, unknown>).url);
      const maybeContent = ensureString((value as Record<string, unknown>).content);
      if (maybeUrl && isHttpUrl(maybeUrl)) {
        return (
          <div className="space-y-2">
            <a href={maybeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:underline">
              <Link2 className="h-3 w-3" />
              {maybeUrl}
            </a>
            {maybeContent && (
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/60 p-3 text-xs text-slate-200">{maybeContent}</pre>
            )}
          </div>
        );
      }
      if (maybeContent) {
        return <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/60 p-3 text-xs text-slate-200">{maybeContent}</pre>;
      }
    }

    return (
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950/60 p-3 text-xs text-slate-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  };

  const stringValue = ensureString(result);

  return (
    <div className="space-y-3">
      {label && <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{label}</p>}
      <div className="space-y-3">
        {renderValue(result)}
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          {stringValue && (
            <button
              type="button"
              onClick={() => handleCopy(stringValue)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 hover:border-white/30"
            >
              <Clipboard className="h-3 w-3" /> {t("artifactViewer.actions.copy")}
            </button>
          )}
          {downloadInfo && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 hover:border-white/30"
            >
              <Download className="h-3 w-3" /> {t("artifactViewer.actions.download")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

