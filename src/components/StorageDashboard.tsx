import { useEffect, useState } from 'react';
import { Database, Download, Upload, Trash2, RefreshCw, Eye, EyeOff, Info, CheckCircle2, AlertCircle, Zap, HardDrive } from 'lucide-react';
import { idbStorage } from '../utils/idbStorage';

interface IndexedDbInfo {
  name: string;
  version: number;
  stores: string[];
}

interface StoreRecord {
  key: string;
  value: unknown;
  size: number;
}

interface StorageInsights {
  adapter: string;
  engine: string;
  capabilities: string[];
  persistence: string;
  performance: string;
  limitations: string[];
  recommendations: string[];
}

export function StorageDashboard() {
  const [dbInfo, setDbInfo] = useState<IndexedDbInfo | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [records, setRecords] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [storageAdapter, setStorageAdapter] = useState<string>('IndexedDB (Custom)');
  const [insights, setInsights] = useState<StorageInsights | null>(null);
  const [showInsights, setShowInsights] = useState(true);

  useEffect(() => {
    loadDbInfo();
    generateInsights();
  }, []);

  const generateInsights = () => {
    // Detect storage adapter and generate insights
    const storageInsights: StorageInsights = {
      adapter: 'IndexedDB Adapter',
      engine: 'sql.js (SQLite WASM)',
      capabilities: ['Transactions', 'Persistence', 'JSON Support', 'Prepared Statements'],
      persistence: 'Browser-native IndexedDB (stores SQLite database file as blob)',
      performance: 'Fast reads (in-memory SQL), moderate writes (~10-50ms per batch)',
      limitations: [
        'Single-threaded (no concurrent writes)',
        'Browser-only (not available in Node.js)',
        'Storage quotas vary by browser (typically 50MB-1GB+)',
        'WASM overhead (~500KB bundle size)'
      ],
      recommendations: [
        'Use for offline-first web apps and PWAs',
        'Export backups periodically for data portability',
        'Monitor storage quota usage',
        'Consider PostgreSQL adapter for multi-user cloud deployments'
      ]
    };
    
    setInsights(storageInsights);
  };

  useEffect(() => {
    if (selectedStore) {
      loadStoreRecords(selectedStore);
    }
  }, [selectedStore]);

  const loadDbInfo = async () => {
    try {
      // Detect current storage adapter
      if (typeof window !== 'undefined' && window.indexedDB) {
        setStorageAdapter('IndexedDB (Browser Native)');
      }

      // Get IndexedDB database info
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('agentosClientDB', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const stores: string[] = [];
      for (let i = 0; i < db.objectStoreNames.length; i++) {
        stores.push(db.objectStoreNames[i]);
      }

      setDbInfo({
        name: db.name,
        version: db.version,
        stores,
      });

      if (stores.length > 0 && !selectedStore) {
        setSelectedStore(stores[0]);
      }

      db.close();
    } catch (error) {
      console.error('Failed to load DB info:', error);
    }
  };

  const loadStoreRecords = async (storeName: string) => {
    setLoading(true);
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('agentosClientDB', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const records: StoreRecord[] = [];
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.openCursor();

      await new Promise<void>((resolve, reject) => {
        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const value = cursor.value;
            const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
            records.push({
              key: String(cursor.key),
              value,
              size: new Blob([valueStr]).size,
            });
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => reject(req.error);
      });

      db.close();
      setRecords(records);
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExport = async () => {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('agentosClientDB', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const exportData: Record<string, Record<string, unknown>> = {};
      const stores = Array.from(db.objectStoreNames);

      for (const storeName of stores) {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.openCursor();
        exportData[storeName] = {};

        await new Promise<void>((resolve) => {
          req.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              exportData[storeName][String(cursor.key)] = cursor.value;
              cursor.continue();
            } else {
              resolve();
            }
          };
        });
      }

      db.close();

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentos-storage-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Check console for details.');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text) as Record<string, Record<string, unknown>>;

        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open('agentosClientDB', 1);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        for (const [storeName, records] of Object.entries(importData)) {
          if (!db.objectStoreNames.contains(storeName)) continue;

          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);

          for (const [key, value] of Object.entries(records)) {
            await new Promise<void>((resolve, reject) => {
              const req = store.put(value, key);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            });
          }
        }

        db.close();
        await loadStoreRecords(selectedStore || dbInfo?.stores[0] || '');
        alert('Data imported successfully!');
      } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import data. Check console for details.');
      }
    };
    input.click();
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all storage data? This cannot be undone.')) {
      return;
    }

    try {
      await idbStorage.clearAll();
      setRecords([]);
      alert('Storage cleared successfully!');
    } catch (error) {
      console.error('Clear failed:', error);
      alert('Failed to clear storage. Check console for details.');
    }
  };

  const formatValue = (value: unknown): string => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalSize = records.reduce((sum, r) => sum + r.size, 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/60">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-slate-500">Storage Dashboard</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Database Management</h3>
        </div>
        <button
          type="button"
          onClick={loadDbInfo}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
        >
          <RefreshCw className="mr-1 inline h-3 w-3" />
          Refresh
        </button>
      </header>

      <div className="space-y-4">
        {/* Storage Adapter Insights */}
        {insights && showInsights && (
          <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-4 dark:border-sky-500/30 dark:from-sky-950/40 dark:to-blue-950/40">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Storage Adapter Insights</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowInsights(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                Hide
              </button>
            </div>
            
            <div className="space-y-3 text-xs">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5 text-sky-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Adapter:</span>
                  <span className="text-slate-600 dark:text-slate-300">{insights.adapter}</span>
                </div>
                <div className="ml-5 text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Engine:</span> {insights.engine}
                </div>
                <div className="ml-5 mt-1 text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Persistence:</span> {insights.persistence}
                </div>
                <div className="ml-5 mt-1 text-xs text-sky-600 dark:text-sky-400">
                  💡 <span className="font-medium">Key Value:</span> Automatic persistence (data survives page refresh). sql.js adapter requires manual save.
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Capabilities:</span>
                </div>
                <div className="ml-5 flex flex-wrap gap-1.5">
                  {insights.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Performance:</span>
                </div>
                <div className="ml-5 text-slate-600 dark:text-slate-400">{insights.performance}</div>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Limitations:</span>
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-slate-600 dark:text-slate-400">
                  {insights.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Recommendations:</span>
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-slate-600 dark:text-slate-400">
                  {insights.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {!showInsights && (
          <button
            type="button"
            onClick={() => setShowInsights(true)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-300"
          >
            <Info className="mr-1 inline h-3 w-3" />
            Show Storage Insights
          </button>
        )}

        {/* Storage Adapter Info */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/50">
          <div className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-sky-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">Current Adapter:</span>
            <span className="text-slate-600 dark:text-slate-300">{storageAdapter}</span>
          </div>
          {dbInfo && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
              <div>
                <span className="font-semibold">Database:</span> {dbInfo.name}
              </div>
              <div>
                <span className="font-semibold">Version:</span> {dbInfo.version}
              </div>
              <div className="col-span-2">
                <span className="font-semibold">Stores:</span> {dbInfo.stores.join(', ')}
              </div>
            </div>
          )}
        </div>

        {/* Store Selector */}
        {dbInfo && dbInfo.stores.length > 0 && (
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
              Object Store
            </label>
            <select
              value={selectedStore || ''}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
            >
              {dbInfo.stores.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Records List */}
        {selectedStore && (
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/50">
            <div className="border-b border-slate-200 p-3 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                  Records ({records.length})
                </span>
                {totalSize > 0 && (
                  <span className="text-xs text-slate-600 dark:text-slate-400">Total: {formatSize(totalSize)}</span>
                )}
              </div>
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto p-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading records...</p>
              ) : records.length === 0 ? (
                <p className="text-sm text-slate-500">No records found</p>
              ) : (
                records.map((record) => {
                  const isExpanded = expandedKeys.has(record.key);
                  const valueStr = formatValue(record.value);
                  const preview = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;

                  return (
                    <div
                      key={record.key}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900/60"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExpand(record.key)}
                              className="text-slate-600 hover:text-sky-500 dark:text-slate-400"
                            >
                              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {record.key}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-500">
                              ({formatSize(record.size)})
                            </span>
                          </div>
                          {isExpanded ? (
                            <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
                              {valueStr}
                            </pre>
                          ) : (
                            <pre className="mt-1 text-xs text-slate-600 dark:text-slate-400">{preview}</pre>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200"
          >
            <Download className="h-3 w-3" />
            Export All
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200"
          >
            <Upload className="h-3 w-3" />
            Import
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300"
          >
            <Trash2 className="h-3 w-3" />
            Clear All
          </button>
        </div>
      </div>
    </section>
  );
}

