/**
 * socialStore — Zustand store for the SocialPostComposer panel.
 *
 * Tracks the current draft post, scheduled/past posts, platform selection,
 * and the adapted per-platform content variants.
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported social publishing platforms. */
export type SocialPlatform =
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'threads'
  | 'bluesky'
  | 'mastodon'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'pinterest'
  | 'reddit'
  | 'devto'
  | 'medium'
  | 'hashnode';

/** Publication status of a post record. */
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

export interface PostRecord {
  id: string;
  text: string;
  platforms: SocialPlatform[];
  status: PostStatus;
  scheduledAt: number | null;
  publishedAt: number | null;
  /** URL to the published post, if available. */
  link: string | null;
  mediaUrls: string[];
  /** Per-platform adapted content variants. */
  variants: Partial<Record<SocialPlatform, string>>;
}

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
  uploadedAt: number;
}

// ---------------------------------------------------------------------------
// Platform meta
// ---------------------------------------------------------------------------

export interface PlatformMeta {
  id: SocialPlatform;
  label: string;
  charLimit: number;
  hashtagStyle: 'inline' | 'grouped' | 'none';
  supportedMediaTypes: Array<'image' | 'video'>;
}

export const PLATFORM_META: PlatformMeta[] = [
  { id: 'twitter',   label: 'Twitter / X',  charLimit: 280,   hashtagStyle: 'inline',  supportedMediaTypes: ['image', 'video'] },
  { id: 'linkedin',  label: 'LinkedIn',      charLimit: 3000,  hashtagStyle: 'grouped', supportedMediaTypes: ['image', 'video'] },
  { id: 'facebook',  label: 'Facebook',      charLimit: 63206, hashtagStyle: 'inline',  supportedMediaTypes: ['image', 'video'] },
  { id: 'threads',   label: 'Threads',       charLimit: 500,   hashtagStyle: 'inline',  supportedMediaTypes: ['image', 'video'] },
  { id: 'bluesky',   label: 'Bluesky',       charLimit: 300,   hashtagStyle: 'inline',  supportedMediaTypes: ['image'] },
  { id: 'mastodon',  label: 'Mastodon',      charLimit: 500,   hashtagStyle: 'inline',  supportedMediaTypes: ['image', 'video'] },
  { id: 'instagram', label: 'Instagram',     charLimit: 2200,  hashtagStyle: 'grouped', supportedMediaTypes: ['image', 'video'] },
  { id: 'youtube',   label: 'YouTube',       charLimit: 5000,  hashtagStyle: 'grouped', supportedMediaTypes: ['video'] },
  { id: 'tiktok',    label: 'TikTok',        charLimit: 2200,  hashtagStyle: 'inline',  supportedMediaTypes: ['video'] },
  { id: 'pinterest', label: 'Pinterest',     charLimit: 500,   hashtagStyle: 'grouped', supportedMediaTypes: ['image'] },
  { id: 'reddit',    label: 'Reddit',        charLimit: 40000, hashtagStyle: 'none',    supportedMediaTypes: ['image', 'video'] },
  { id: 'devto',     label: 'Dev.to',        charLimit: 100000,hashtagStyle: 'grouped', supportedMediaTypes: ['image'] },
  { id: 'medium',    label: 'Medium',        charLimit: 100000,hashtagStyle: 'grouped', supportedMediaTypes: ['image'] },
  { id: 'hashnode',  label: 'Hashnode',      charLimit: 100000,hashtagStyle: 'grouped', supportedMediaTypes: ['image'] },
];

// ---------------------------------------------------------------------------
// ContentAdaptationEngine (static rules, mirrors backend ContentAdaptationEngine)
// ---------------------------------------------------------------------------

/**
 * Produces a platform-adapted variant of the source text by applying
 * the static rules from ContentAdaptationEngine:
 *   - Truncate at char limit (–3 chars for "…").
 *   - Move hashtags to end if `hashtagStyle === 'grouped'`.
 *   - Strip hashtags if `hashtagStyle === 'none'`.
 */
export function adaptForPlatform(text: string, meta: PlatformMeta): string {
  let adapted = text;

  // Extract hashtags
  const hashtagRegex = /#[\w\u00C0-\u017F]+/g;
  const hashtags = (text.match(hashtagRegex) ?? []).join(' ');
  const withoutHashtags = text.replace(hashtagRegex, '').replace(/\s{2,}/g, ' ').trim();

  if (meta.hashtagStyle === 'grouped') {
    adapted = hashtags ? `${withoutHashtags}\n\n${hashtags}` : withoutHashtags;
  } else if (meta.hashtagStyle === 'none') {
    adapted = withoutHashtags;
  }

  // Truncate
  if (adapted.length > meta.charLimit) {
    adapted = `${adapted.slice(0, meta.charLimit - 1)}…`;
  }

  return adapted;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface SocialState {
  draftText: string;
  selectedPlatforms: Set<SocialPlatform>;
  mediaItems: MediaItem[];
  posts: PostRecord[];
  scheduledAt: number | null;
  loading: boolean;
  error: string | null;

  setDraftText: (text: string) => void;
  togglePlatform: (platform: SocialPlatform) => void;
  setSelectedPlatforms: (platforms: SocialPlatform[]) => void;
  addMedia: (item: MediaItem) => void;
  removeMedia: (id: string) => void;
  addPost: (post: PostRecord) => void;
  updatePost: (id: string, patch: Partial<PostRecord>) => void;
  setPosts: (posts: PostRecord[]) => void;
  setScheduledAt: (at: number | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSocialStore = create<SocialState>((set) => ({
  draftText: '',
  selectedPlatforms: new Set(),
  mediaItems: [],
  posts: [],
  scheduledAt: null,
  loading: false,
  error: null,

  setDraftText: (text) => set({ draftText: text }),

  togglePlatform: (platform) =>
    set((s) => {
      const next = new Set(s.selectedPlatforms);
      if (next.has(platform)) next.delete(platform); else next.add(platform);
      return { selectedPlatforms: next };
    }),

  setSelectedPlatforms: (platforms) =>
    set({ selectedPlatforms: new Set(platforms) }),

  addMedia: (item) =>
    set((s) => ({ mediaItems: [...s.mediaItems, item] })),

  removeMedia: (id) =>
    set((s) => ({ mediaItems: s.mediaItems.filter((m) => m.id !== id) })),

  addPost: (post) =>
    set((s) => ({ posts: [post, ...s.posts] })),

  updatePost: (id, patch) =>
    set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

  setPosts: (posts) => set({ posts }),
  setScheduledAt: (at) => set({ scheduledAt: at }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
