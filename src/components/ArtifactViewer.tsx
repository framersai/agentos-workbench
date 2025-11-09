import { useCallback, useMemo } from "react";
import { Clipboard, Download, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";

interface ArtifactViewerProps {
  result: unknown;
  label?: string;
  format?: 'json' | 'csv' | 'markdown' | 'text';
}

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const isLikelyBase64 = (value: string): boolean => /^[A-Za-z0-9+/=]+$/.test(value) && value.length % 4 === 0;

export function ArtifactViewer({ result, label, format }: ArtifactViewerProps) {
  const { t } = useTranslation();
  const ensureString = (value: unknown): string | null => (typeof value === "string" ? value : null);

  // Detect format from content if not explicitly provided
  const detectedFormat = useMemo(() => {
    if (format) return format;
    const str = ensureString(result);
    if (!str) return 'json';
    if (str.trim().startsWith('{') || str.trim().startsWith('[')) return 'json';
    if (str.includes(',') && str.includes('\n') && str.split('\n').length > 1) return 'csv';
    if (str.includes('#') || str.includes('**') || str.includes('```')) return 'markdown';
    return 'text';
  }, [result, format]);

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
    const str = ensureString(value);
    
    // Handle CSV format
    if (detectedFormat === 'csv' && str) {
      const lines = str.trim().split('\n').filter(l => l.trim());
      const headers = lines[0]?.split(',').map(h => h.trim()) || [];
      const rows = lines.slice(1).map(line => line.split(',').map(c => c.trim()));
      
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-slate-600 text-xs">
            <thead>
              <tr className="bg-slate-800">
                {headers.map((h, i) => (
                  <th key={i} className="border border-slate-600 px-3 py-2 text-left font-semibold text-slate-200">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-800/50">
                  {row.map((cell, j) => (
                    <td key={j} className="border border-slate-600 px-3 py-2 text-slate-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    // Handle JSON format
    if (detectedFormat === 'json') {
      let jsonValue: unknown = value;
      if (str) {
        try {
          jsonValue = JSON.parse(str);
        } catch {
          // Fall through to string rendering
        }
      }
      
      if (typeof jsonValue === 'object' && jsonValue !== null) {
        return (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950/60 p-3 text-xs text-slate-200">
            {JSON.stringify(jsonValue, null, 2)}
          </pre>
        );
      }
    }
    
    // Handle Markdown format
    if (detectedFormat === 'markdown' && str) {
      return (
        <div className="prose prose-invert max-w-none rounded-lg bg-slate-950/60 p-4 text-sm text-slate-200 prose-headings:text-slate-100 prose-p:text-slate-200 prose-strong:text-slate-100 prose-code:text-emerald-300 prose-pre:bg-slate-900">
          <ReactMarkdown>{str}</ReactMarkdown>
        </div>
      );
    }
    
    // Handle plain text
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

