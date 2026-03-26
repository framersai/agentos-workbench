/**
 * @file channelsStore.ts
 * @description Zustand store for the {@link ChannelsManager} panel.
 *
 * State shape:
 * ```
 * {
 *   channels:  ChannelInfo[]      -- 37 platform entries with status + credentials
 *   messages:  ChannelMessage[]   -- cross-channel message log (max 200)
 *   loading:   boolean            -- true during status fetch
 *   error:     string | null      -- last fetch error
 * }
 * ```
 *
 * The 37 channels span 7 categories:
 *   - Social (9):    twitter, linkedin, facebook, instagram, threads, pinterest, snapchat, bluesky, mastodon
 *   - Messaging (9): discord, slack, telegram, whatsapp, line, wechat, viber, signal, matrix
 *   - Video (5):     youtube, tiktok, twitch, vimeo, rumble
 *   - Blog (6):      devto, hashnode, medium, wordpress, ghost, substack
 *   - Community (4): reddit, farcaster, lemmy, nostr
 *   - Business (4):  googlebusiness, gmb, shopify, hubspot
 *
 * Each channel holds a `credentials: Record<string, string>` map keyed by
 * the required fields for that platform (e.g. `botToken`, `apiKey`, etc.).
 * Credential fields with names containing "secret", "password", or "token"
 * are rendered as password inputs in the UI.
 *
 * Messages are capped at 200 entries via `addMessage()`.
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChannelStatus = 'connected' | 'disconnected' | 'error' | 'rate-limited';

export interface ChannelInfo {
  /** Unique platform identifier (matches ChannelPlatform enum values). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Channel category for grouping in the UI. */
  category: 'social' | 'messaging' | 'video' | 'audio' | 'blog' | 'community' | 'business';
  status: ChannelStatus;
  lastMessageAt: number | null;
  errorCount: number;
  /** Rate-limit remaining calls (0–1000, null if unknown). */
  rateLimitRemaining: number | null;
  /** Credential fields required to connect (field name → current value). */
  credentials: Record<string, string>;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  channelName: string;
  sender: string;
  text: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Initial channel catalog (37 entries)
// ---------------------------------------------------------------------------

function makeChannel(
  id: string,
  name: string,
  category: ChannelInfo['category'],
  credentialFields: string[]
): ChannelInfo {
  return {
    id,
    name,
    category,
    status: 'disconnected',
    lastMessageAt: null,
    errorCount: 0,
    rateLimitRemaining: null,
    credentials: Object.fromEntries(credentialFields.map((f) => [f, ''])),
  };
}

const INITIAL_CHANNELS: ChannelInfo[] = [
  // Social
  makeChannel('twitter', 'Twitter / X', 'social', ['apiKey', 'apiSecret', 'accessToken', 'accessSecret']),
  makeChannel('linkedin', 'LinkedIn', 'social', ['clientId', 'clientSecret', 'accessToken']),
  makeChannel('facebook', 'Facebook', 'social', ['pageAccessToken', 'pageId']),
  makeChannel('instagram', 'Instagram', 'social', ['accessToken', 'accountId']),
  makeChannel('threads', 'Threads', 'social', ['accessToken', 'accountId']),
  makeChannel('pinterest', 'Pinterest', 'social', ['accessToken', 'boardId']),
  makeChannel('snapchat', 'Snapchat', 'social', ['clientId', 'clientSecret']),
  makeChannel('bluesky', 'Bluesky', 'social', ['identifier', 'appPassword']),
  makeChannel('mastodon', 'Mastodon', 'social', ['instanceUrl', 'accessToken']),

  // Messaging
  makeChannel('discord', 'Discord', 'messaging', ['botToken', 'guildId', 'channelId']),
  makeChannel('slack', 'Slack', 'messaging', ['botToken', 'signingSecret', 'channelId']),
  makeChannel('telegram', 'Telegram', 'messaging', ['botToken', 'chatId']),
  makeChannel('whatsapp', 'WhatsApp', 'messaging', ['phoneNumberId', 'accessToken', 'webhookSecret']),
  makeChannel('line', 'LINE', 'messaging', ['channelAccessToken', 'channelSecret']),
  makeChannel('wechat', 'WeChat', 'messaging', ['appId', 'appSecret', 'token']),
  makeChannel('viber', 'Viber', 'messaging', ['authToken']),
  makeChannel('signal', 'Signal', 'messaging', ['phoneNumber']),
  makeChannel('matrix', 'Matrix', 'messaging', ['homeserverUrl', 'accessToken', 'roomId']),

  // Video
  makeChannel('youtube', 'YouTube', 'video', ['apiKey', 'channelId', 'accessToken']),
  makeChannel('tiktok', 'TikTok', 'video', ['clientKey', 'clientSecret', 'accessToken']),
  makeChannel('twitch', 'Twitch', 'video', ['clientId', 'clientSecret', 'accessToken', 'channelName']),
  makeChannel('vimeo', 'Vimeo', 'video', ['accessToken']),
  makeChannel('rumble', 'Rumble', 'video', ['apiKey']),

  // Blog / Content
  makeChannel('devto', 'Dev.to', 'blog', ['apiKey']),
  makeChannel('hashnode', 'Hashnode', 'blog', ['accessToken', 'publicationId']),
  makeChannel('medium', 'Medium', 'blog', ['accessToken', 'publicationId']),
  makeChannel('wordpress', 'WordPress', 'blog', ['siteUrl', 'username', 'applicationPassword']),
  makeChannel('ghost', 'Ghost', 'blog', ['apiUrl', 'adminApiKey']),
  makeChannel('substack', 'Substack', 'blog', ['email', 'password']),

  // Community
  makeChannel('reddit', 'Reddit', 'community', ['clientId', 'clientSecret', 'username', 'password']),
  makeChannel('farcaster', 'Farcaster', 'community', ['privateKey', 'fid']),
  makeChannel('lemmy', 'Lemmy', 'community', ['instanceUrl', 'username', 'password']),
  makeChannel('nostr', 'Nostr', 'community', ['privateKey', 'relayUrl']),

  // Business
  makeChannel('googlebusiness', 'Google Business', 'business', ['accountId', 'locationId', 'accessToken']),
  makeChannel('gmb', 'Google My Business', 'business', ['accessToken', 'locationName']),
  makeChannel('shopify', 'Shopify', 'business', ['shopUrl', 'accessToken']),
  makeChannel('hubspot', 'HubSpot', 'business', ['accessToken', 'portalId']),
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Zustand state + actions for the ChannelsManager. */
interface ChannelsState {
  /** All 37 channel entries with status, credentials, and metrics. */
  channels: ChannelInfo[];
  /** Cross-channel message log, newest first (max 200). */
  messages: ChannelMessage[];
  /** True while fetching status from the backend. */
  loading: boolean;
  /** Last fetch error message, or null. */
  error: string | null;

  /** Replace the full channels list (after backend refresh). */
  setChannels: (channels: ChannelInfo[]) => void;
  /** Patch a single channel by ID (status, credentials, etc.). */
  updateChannel: (id: string, patch: Partial<ChannelInfo>) => void;
  /** Prepend a message to the log (capped at 200). */
  addMessage: (msg: ChannelMessage) => void;
  /** Replace the full message log. */
  setMessages: (msgs: ChannelMessage[]) => void;
  /** Set the loading flag. */
  setLoading: (loading: boolean) => void;
  /** Set or clear the error message. */
  setError: (error: string | null) => void;
}

export const useChannelsStore = create<ChannelsState>((set) => ({
  channels: INITIAL_CHANNELS,
  messages: [],
  loading: false,
  error: null,

  setChannels: (channels) => set({ channels }),

  updateChannel: (id, patch) =>
    set((s) => ({
      channels: s.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  addMessage: (msg) =>
    set((s) => ({ messages: [msg, ...s.messages].slice(0, 200) })),

  setMessages: (msgs) => set({ messages: msgs }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
