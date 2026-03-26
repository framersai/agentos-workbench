/**
 * @file socialStore.ts
 * @description Zustand store for the {@link SocialPostComposer} panel.
 *
 * State shape:
 * ```
 * {
 *   draftText:          string                -- current draft post body
 *   selectedPlatforms:  Set<SocialPlatform>   -- checked target platforms
 *   mediaItems:         MediaItem[]           -- uploaded images / videos
 *   posts:              PostRecord[]          -- scheduled + published history
 *   scheduledAt:        number | null         -- epoch ms if schedule mode on
 *   loading:            boolean               -- history fetch in progress
 *   error:              string | null         -- last error
 * }
 * ```
 *
 * Platform metadata ({@link PLATFORM_META}) covers 14 social platforms with:
 *   - Character limits (280 for Twitter up to 100 000 for blog platforms)
 *   - Hashtag styles: `inline` | `grouped` (moved to footer) | `none` (stripped)
 *   - Supported media types: image and/or video
 *
 * The {@link adaptForPlatform} function mirrors the backend
 * `ContentAdaptationEngine` by applying static rules:
 *   1. Extract hashtags via regex.
 *   2. Reposition or strip hashtags based on `hashtagStyle`.
 *   3. Truncate at `charLimit - 1` with trailing ellipsis.
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
 * the static rules from ContentAdaptationEngine.
 *
 * Adaptation steps:
 *   1. Extract all `#hashtag` tokens via regex.
 *   2. If `hashtagStyle === 'grouped'`: strip inline hashtags, append grouped at end.
 *   3. If `hashtagStyle === 'none'`: strip all hashtags entirely.
 *   4. If `hashtagStyle === 'inline'`: leave hashtags in-place.
 *   5. Truncate to `charLimit - 1` characters, appending ellipsis if needed.
 *
 * @param text - The original post text to adapt.
 * @param meta - Platform metadata containing charLimit, hashtagStyle, etc.
 * @returns The adapted text variant for the specified platform.
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

/** Zustand state + actions for the SocialPostComposer. */
interface SocialState {
  /** Current draft post body text. */
  draftText: string;
  /** Set of checked target platform IDs. */
  selectedPlatforms: Set<SocialPlatform>;
  /** Uploaded media items (images/videos) attached to the draft. */
  mediaItems: MediaItem[];
  /** Post history (scheduled + published), newest first. */
  posts: PostRecord[];
  /** Schedule timestamp in epoch ms, or null for immediate publish. */
  scheduledAt: number | null;
  /** True while post history is being fetched from backend. */
  loading: boolean;
  /** Last error message, or null. */
  error: string | null;

  /** Update the draft text. */
  setDraftText: (text: string) => void;
  /** Toggle a platform on/off in the selection set. */
  togglePlatform: (platform: SocialPlatform) => void;
  /** Replace the entire platform selection. */
  setSelectedPlatforms: (platforms: SocialPlatform[]) => void;
  /** Append a media item to the draft. */
  addMedia: (item: MediaItem) => void;
  /** Remove a media item by ID. */
  removeMedia: (id: string) => void;
  /** Prepend a new post to history. */
  addPost: (post: PostRecord) => void;
  /** Patch a post by ID (e.g. update status after publish). */
  updatePost: (id: string, patch: Partial<PostRecord>) => void;
  /** Replace the full post list (after backend refresh). */
  setPosts: (posts: PostRecord[]) => void;
  /** Set or clear the schedule timestamp. */
  setScheduledAt: (at: number | null) => void;
  /** Set the loading flag. */
  setLoading: (loading: boolean) => void;
  /** Set or clear the error message. */
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
