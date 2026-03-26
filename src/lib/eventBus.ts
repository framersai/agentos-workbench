/**
 * @file eventBus.ts
 * @description Singleton Server-Sent Events (SSE) event bus for real-time workbench events.
 *
 * All panels that need live data (VoiceCallMonitor, LiveHITLQueue,
 * EmergentToolForge, ChannelsManager, etc.) subscribe through this bus
 * instead of individual polling loops.
 *
 * The bus automatically reconnects via the EventSource API's built-in retry
 * mechanism.  Callers can also call {@link connect} again to change the URL.
 *
 * @example
 * ```ts
 * import { eventBus } from '@/lib/eventBus';
 *
 * // connect once at app root
 * eventBus.connect('http://localhost:3001/events');
 *
 * // subscribe in any component
 * const unsub = eventBus.on('hitl:approval-needed', (data) => console.log(data));
 * // later…
 * unsub();
 * ```
 */

// ---------------------------------------------------------------------------
// Event type catalogue
// ---------------------------------------------------------------------------

/** All event names broadcast by the backend `/events` SSE stream. */
export type WorkbenchEventName =
  | 'voice:transcript'
  | 'hitl:approval-needed'
  | 'forge:verdict'
  | 'channel:message'
  | 'agency:agent-start'
  | 'agency:agent-end'
  | '__connected__'
  | 'error'
  | string; // allow ad-hoc events

/** Raw envelope sent over the wire. */
export interface WorkbenchEvent {
  /** Matches a {@link WorkbenchEventName}. */
  event: WorkbenchEventName;
  /** Event-specific payload — shape varies by event name. */
  data: unknown;
}

// ---------------------------------------------------------------------------
// EventBus class
// ---------------------------------------------------------------------------

/**
 * Singleton SSE event bus.
 *
 * Create the singleton via the exported {@link eventBus} constant; do not
 * instantiate this class directly.
 */
class EventBus {
  private es: EventSource | null = null;
  private url: string | null = null;
  /** Map of event name → set of handler functions. */
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private _connected = false;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Open an SSE connection to the given URL.
   *
   * Safe to call multiple times — if already connected to the same URL the
   * call is a no-op.
   */
  connect(url: string): void {
    if (this.es && this.url === url) {
      return; // already connected or connecting
    }
    // Close any previous connection first
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.url = url;
    this._openSource();
  }

  /**
   * Permanently close the SSE connection.
   */
  disconnect(): void {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this._connected = false;
    this.url = null;
  }

  /**
   * Subscribe to an event.
   *
   * @returns An unsubscribe function — call it to remove this handler.
   */
  on(event: WorkbenchEventName, handler: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.listeners.get(event)!.add(handler);

    return () => {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Notify all subscribers for a given event.
   *
   * Components can use this to broadcast synthetic events locally without
   * going through the server.
   */
  emit(event: WorkbenchEventName, data: unknown): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EventBus] Handler error for event "${event}":`, err);
        }
      }
    }
  }

  /** True when the SSE connection is currently open. */
  get isConnected(): boolean {
    return this._connected;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private _openSource(): void {
    if (!this.url) return;

    try {
      const es = new EventSource(this.url);

      es.onmessage = (ev) => {
        try {
          const envelope = JSON.parse(ev.data as string) as WorkbenchEvent;
          if (envelope && typeof envelope.event === 'string') {
            if (envelope.event === '__connected__') {
              this._connected = true;
            }
            this.emit(envelope.event, envelope.data);
          }
        } catch {
          // Non-JSON frame — ignore silently
        }
      };

      es.onerror = () => {
        this._connected = false;
        // EventSource reconnects automatically — no manual retry needed
      };

      this.es = es;
    } catch (err) {
      console.warn('[EventBus] Failed to open EventSource:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Shared event bus instance — import and use throughout the workbench. */
export const eventBus = new EventBus();
