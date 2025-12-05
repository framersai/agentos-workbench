/**
 * @file RagMemoryDashboard.tsx
 * @description Dashboard component for managing RAG (Retrieval Augmented Generation) memory.
 * Displays memory statistics, collections, and provides document management capabilities.
 *
 * @module RagMemoryDashboard
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
  FileText,
  Folder,
  Trash2,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle,
  Info,
  Layers,
} from "lucide-react";

/**
 * RAG service health response
 */
interface RagHealthResponse {
  status: "ready" | "disabled" | "initializing";
  ragServiceInitialized: boolean;
  vectorStoreConnected: boolean;
  embeddingServiceAvailable: boolean;
  stats?: {
    totalDocuments: number;
    totalChunks: number;
    collectionCount: number;
  };
  message?: string;
}

/**
 * RAG statistics response
 */
interface RagStatsResponse {
  success: boolean;
  totalDocuments: number;
  totalChunks: number;
  collections: Array<{
    collectionId: string;
    documentCount: number;
    chunkCount: number;
  }>;
  storageUsedBytes?: number;
}

/**
 * RAG collection summary
 */
interface RagCollection {
  collectionId: string;
  displayName?: string;
  documentCount: number;
}

/**
 * RAG document summary
 */
interface RagDocument {
  documentId: string;
  collectionId: string;
  chunkCount: number;
  category?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * RAG query result item
 */
interface RagQueryResult {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Props for RagMemoryDashboard
 */
interface RagMemoryDashboardProps {
  /** API base URL (defaults to /api/agentos) */
  apiBaseUrl?: string;
  /** Currently selected agent ID for filtering */
  agentId?: string;
  /** Callback when a document is deleted */
  onDocumentDeleted?: (documentId: string) => void;
}

/**
 * RAG Memory Dashboard Component
 *
 * Provides a comprehensive view of RAG memory with:
 * - Health status indicator
 * - Memory statistics (documents, chunks, collections)
 * - Collection browser
 * - Document list with delete capability
 * - Query testing interface
 *
 * @example
 * <RagMemoryDashboard
 *   apiBaseUrl="/api/agentos"
 *   agentId="agent-123"
 *   onDocumentDeleted={(id) => console.log('Deleted:', id)}
 * />
 */
export const RagMemoryDashboard: React.FC<RagMemoryDashboardProps> = ({
  apiBaseUrl = "/api/agentos",
  agentId,
  onDocumentDeleted,
}) => {
  const { t } = useTranslation();

  // State
  const [health, setHealth] = useState<RagHealthResponse | null>(null);
  const [stats, setStats] = useState<RagStatsResponse | null>(null);
  const [collections, setCollections] = useState<RagCollection[]>([]);
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [queryResults, setQueryResults] = useState<RagQueryResult[] | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  // Fetch health status
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/rag/health`);
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      console.error("[RagMemoryDashboard] Failed to fetch health:", err);
    }
  }, [apiBaseUrl]);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const url = agentId
        ? `${apiBaseUrl}/rag/stats?agentId=${encodeURIComponent(agentId)}`
        : `${apiBaseUrl}/rag/stats`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setStats(data);
      }
    } catch (err) {
      console.error("[RagMemoryDashboard] Failed to fetch stats:", err);
    }
  }, [apiBaseUrl, agentId]);

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/rag/collections`);
      const data = await response.json();
      if (data.success) {
        setCollections(data.collections || []);
      }
    } catch (err) {
      console.error("[RagMemoryDashboard] Failed to fetch collections:", err);
    }
  }, [apiBaseUrl]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCollection) params.set("collectionId", selectedCollection);
      if (agentId) params.set("agentId", agentId);
      params.set("limit", "100");

      const response = await fetch(`${apiBaseUrl}/rag/documents?${params}`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("[RagMemoryDashboard] Failed to fetch documents:", err);
    }
  }, [apiBaseUrl, selectedCollection, agentId]);

  // Delete document
  const deleteDocument = async (documentId: string) => {
    if (!confirm(t("ragDashboard.confirmDelete", "Are you sure you want to delete this document?"))) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/rag/documents/${documentId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        setDocuments((prev) => prev.filter((d) => d.documentId !== documentId));
        onDocumentDeleted?.(documentId);
        // Refresh stats
        fetchStats();
      } else {
        setError(data.message || "Failed to delete document");
      }
    } catch (err) {
      console.error("[RagMemoryDashboard] Failed to delete document:", err);
      setError("Failed to delete document");
    }
  };

  // Execute query
  const executeQuery = async () => {
    if (!queryText.trim()) return;

    setIsQuerying(true);
    setQueryResults(null);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          collectionIds: selectedCollection ? [selectedCollection] : undefined,
          topK: 5,
          includeMetadata: true,
          filters: agentId ? { agentId } : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setQueryResults(data.chunks || []);
      } else {
        setError(data.message || "Query failed");
      }
    } catch (err) {
      console.error("[RagMemoryDashboard] Query failed:", err);
      setError("Query failed");
    } finally {
      setIsQuerying(false);
    }
  };

  // Refresh all data
  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchHealth(), fetchStats(), fetchCollections(), fetchDocuments()]);
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    refreshAll();
  }, []);

  // Reload documents when collection changes
  useEffect(() => {
    fetchDocuments();
  }, [selectedCollection, fetchDocuments]);

  // Status indicator component
  const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
    const statusConfig = {
      ready: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
      initializing: { icon: RefreshCw, color: "text-yellow-500", bg: "bg-yellow-500/10" },
      disabled: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disabled;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color} ${status === "initializing" ? "animate-spin" : ""}`} />
        <span className={`text-sm font-medium ${config.color}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
    );
  };

  // Stat card component
  const StatCard: React.FC<{
    icon: React.ElementType;
    label: string;
    value: number | string;
    subtext?: string;
  }> = ({ icon: Icon, label, value, subtext }) => (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold">
            {t("ragDashboard.title", "RAG Memory Dashboard")}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {health && <StatusIndicator status={health.status} />}
          <button
            onClick={refreshAll}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            aria-label={t("ragDashboard.refresh", "Refresh")}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={FileText}
          label={t("ragDashboard.documents", "Documents")}
          value={stats?.totalDocuments ?? 0}
        />
        <StatCard
          icon={Layers}
          label={t("ragDashboard.chunks", "Chunks")}
          value={stats?.totalChunks ?? 0}
        />
        <StatCard
          icon={Folder}
          label={t("ragDashboard.collections", "Collections")}
          value={collections.length}
        />
      </div>

      {/* Query Interface */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Search className="w-4 h-4" />
          {t("ragDashboard.queryTest", "Test Query")}
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && executeQuery()}
            placeholder={t("ragDashboard.queryPlaceholder", "Enter a query to test retrieval...")}
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
          <button
            onClick={executeQuery}
            disabled={isQuerying || !queryText.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {isQuerying ? t("ragDashboard.searching", "Searching...") : t("ragDashboard.search", "Search")}
          </button>
        </div>

        {/* Query Results */}
        {queryResults && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {queryResults.length} {t("ragDashboard.resultsFound", "results found")}
            </p>
            {queryResults.map((result, index) => (
              <div key={index} className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    Score: {(result.score * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">{result.documentId}</span>
                </div>
                <p className="text-sm line-clamp-3">{result.content}</p>
              </div>
            ))}
            {queryResults.length === 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Info className="w-4 h-4" />
                <span className="text-sm">{t("ragDashboard.noResults", "No matching results found")}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collections List */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Folder className="w-4 h-4" />
          {t("ragDashboard.collectionsTitle", "Collections")}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCollection(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCollection === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {t("ragDashboard.allCollections", "All")}
          </button>
          {collections.map((col) => (
            <button
              key={col.collectionId}
              onClick={() => setSelectedCollection(col.collectionId)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCollection === col.collectionId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {col.displayName || col.collectionId}
              <span className="ml-1 text-xs opacity-70">({col.documentCount})</span>
            </button>
          ))}
          {collections.length === 0 && (
            <span className="text-sm text-muted-foreground">
              {t("ragDashboard.noCollections", "No collections yet")}
            </span>
          )}
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {t("ragDashboard.documentsTitle", "Documents")}
          {selectedCollection && (
            <span className="text-muted-foreground">in {selectedCollection}</span>
          )}
        </h3>
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.documentId}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.documentId}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{doc.chunkCount} chunks</span>
                  {doc.category && <span>{doc.category}</span>}
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => deleteDocument(doc.documentId)}
                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={t("ragDashboard.delete", "Delete")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">{t("ragDashboard.noDocuments", "No documents in this collection")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Footer */}
      {health?.message && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4" />
          <span>{health.message}</span>
        </div>
      )}
    </div>
  );
};

export default RagMemoryDashboard;


