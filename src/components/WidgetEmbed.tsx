import { useCallback, useMemo, useRef, useState } from "react";
import { Code, Maximize2, Minimize2, ExternalLink, Download, ChevronUp, ChevronDown } from "lucide-react";
import { WidgetSourceViewer } from "./WidgetSourceViewer";

/**
 * Props for the {@link WidgetEmbed} component.
 */
export interface WidgetEmbedProps {
  /** Raw HTML string to render inside the sandboxed iframe. */
  html: string;
}

/**
 * Extract a human-readable title from an HTML string.
 *
 * Looks for a `<title>` tag first, then falls back to the first `<h1>`.
 * Returns `"Widget"` when neither is found.
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim();
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]?.trim()) return h1Match[1].trim().replace(/<[^>]*>/g, "");
  return "Widget";
}

/**
 * Sandboxed iframe container for rendering agent-generated HTML widgets.
 *
 * Features:
 * - `<iframe srcDoc>` with `allow-scripts allow-same-origin` sandbox
 * - Collapse / expand toggle
 * - Fullscreen toggle
 * - Open in new browser tab
 * - Download as `.html` file
 * - View source panel (read-only, with copy button via {@link WidgetSourceViewer})
 *
 * The default height is 400px and the iframe supports CSS vertical resize.
 */
export const WidgetEmbed: React.FC<WidgetEmbedProps> = ({ html }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSource, setShowSource] = useState(false);

  const title = useMemo(() => extractTitle(html), [html]);

  /** Open the widget HTML in a new browser tab. */
  const handleOpenNewTab = useCallback(() => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Revoke after a short delay so the tab has time to load
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [html]);

  /** Download the widget HTML as a file. */
  const handleDownload = useCallback(() => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    anchor.download = `${safeTitle}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [html, title]);

  /** Toolbar button styling shared across all actions. */
  const btnClass =
    "rounded-md p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors";

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-slate-900"
          : "my-3 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden"
      }
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-1.5">
        <span className="truncate text-xs font-medium text-slate-300">{title}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setShowSource((v) => !v)} title="View source" className={btnClass}>
            <Code className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className={btnClass}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={handleOpenNewTab} title="Open in new tab" className={btnClass}>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={handleDownload} title="Download HTML" className={btnClass}>
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand" : "Collapse"}
            className={btnClass}
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Source viewer panel */}
      {showSource && !collapsed && (
        <div className="border-b border-slate-700">
          <WidgetSourceViewer html={html} />
        </div>
      )}

      {/* Sandboxed iframe */}
      {!collapsed && (
        <iframe
          ref={iframeRef}
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          title={title}
          className="w-full border-0 bg-white"
          style={{
            height: fullscreen ? "100%" : "400px",
            resize: fullscreen ? "none" : "vertical",
            minHeight: fullscreen ? undefined : "150px",
          }}
        />
      )}
    </div>
  );
};
