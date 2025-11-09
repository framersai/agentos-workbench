/**
 * @fileoverview AgentOS Storage Setup - Client-side storage initialization
 * @description Creates and configures storage adapter for AgentOS with schema setup.
 * This is AgentOS-specific code that lives in agentos-client, not in sql-storage-adapter.
 */

import { IndexedDbAdapter, type StorageAdapter } from '@framers/sql-storage-adapter';

/**
 * AgentOS schema SQL for conversations, sessions, personas, etc.
 * This is AgentOS-specific and should not be in sql-storage-adapter.
 */
const AGENTOS_SCHEMA_SQL = `
-- Conversations (GMI interactions)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT DEFAULT '{}'
);

-- Conversation events (streaming chunks, tool calls, etc.)
CREATE TABLE IF NOT EXISTS conversation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Sessions (UI/UX grouping of conversations)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  target_type TEXT CHECK(target_type IN ('persona', 'agency')) NOT NULL,
  target_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT DEFAULT '{}'
);

-- Persona definitions (cached locally)
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  definition TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Telemetry (token usage, costs, performance)
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

-- Workflows (cached definitions)
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_events_conversation_id ON conversation_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_events_timestamp ON conversation_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_session_id ON telemetry(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);
`;

/**
 * Creates a storage adapter for AgentOS with IndexedDB (browser) or auto-detection.
 * Sets up AgentOS-specific schema.
 * 
 * @param dbName - Database name (default: 'agentos-client-db')
 * @returns Initialized StorageAdapter with AgentOS schema
 */
export async function createAgentOSStorageAdapter(dbName = 'agentos-client-db'): Promise<StorageAdapter> {
  // Use IndexedDB adapter directly for browser
  // Configure sql.js to load WASM file correctly in Vite
  const adapter = new IndexedDbAdapter({
    dbName,
    autoSave: true,
    sqlJsConfig: {
      // Configure WASM file location for Vite
      locateFile: (file: string) => {
        // Vite serves files from public directory at root
        if (file.endsWith('.wasm')) {
          return `/sql-wasm.wasm`;
        }
        return file;
      }
    }
  });

  await adapter.open();

  // Create AgentOS schema
  const statements = AGENTOS_SCHEMA_SQL.split(';').filter(s => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      await adapter.run(statement);
    }
  }

  console.info('[AgentOSStorage] Schema initialized with IndexedDB adapter.');

  return adapter;
}

