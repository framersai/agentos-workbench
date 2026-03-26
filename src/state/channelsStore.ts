/**
 * channelsStore — Zustand store for the ChannelsManager panel.
 *
 * Tracks connected/disconnected status for each of the 37 supported
 * channel platforms, recent cross-channel message logs, broadcast history,
 * and per-channel configuration values.
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

interface ChannelsState {
  channels: ChannelInfo[];
  messages: ChannelMessage[];
  loading: boolean;
  error: string | null;

  setChannels: (channels: ChannelInfo[]) => void;
  updateChannel: (id: string, patch: Partial<ChannelInfo>) => void;
  addMessage: (msg: ChannelMessage) => void;
  setMessages: (msgs: ChannelMessage[]) => void;
  setLoading: (loading: boolean) => void;
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
