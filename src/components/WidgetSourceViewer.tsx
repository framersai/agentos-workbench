import { useCallback, useState } from "react";
import { Clipboard, Check } from "lucide-react";

/**
 * Props for the {@link WidgetSourceViewer} component.
 */
export interface WidgetSourceViewerProps {
  /** Raw HTML source string to display in the viewer. */
  html: string;
}

/**
 * Read-only HTML source viewer with a one-click copy button.
 *
 * Renders the raw HTML inside a scrollable `<pre><code>` block styled for the
 * workbench dark theme. The copy button provides brief visual feedback on
 * success.
 */
export const WidgetSourceViewer: React.FC<WidgetSourceViewerProps> = ({ html }) => {
  const [copied, setCopied] = useState(false);

  /** Copy the raw HTML to the clipboard and flash a confirmation icon. */
  const handleCopy = useCallback(() => {
    void navigator.clipboard?.writeText(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => void 0);
  }, [html]);

  return (
    <div className="relative rounded-lg border border-slate-700 bg-slate-950">
      <button
        type="button"
        onClick={handleCopy}
        title="Copy source HTML to clipboard"
        className="absolute right-2 top-2 rounded-md border border-slate-600 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Clipboard className="h-3.5 w-3.5" />}
      </button>
      <pre className="max-h-96 overflow-auto p-4 pr-12 text-xs leading-relaxed">
        <code className="font-mono text-slate-300 whitespace-pre-wrap break-words">{html}</code>
      </pre>
    </div>
  );
};
