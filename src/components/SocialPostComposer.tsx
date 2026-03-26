/**
 * SocialPostComposer — multi-platform social post composer and scheduler.
 *
 * Sub-tabs:
 *   Compose  — rich text area, platform selector, media uploader,
 *              schedule picker, and Post Now / Schedule buttons.
 *   Preview  — side-by-side per-platform preview with char counts and
 *              content adaptation variants.
 *   History  — table of past/scheduled posts with status, platform, date, link.
 *
 * Backend routes:
 *   POST /api/social/compose    — immediate publish.
 *   POST /api/social/schedule   — schedule a post.
 *   GET  /api/social/posts      — fetch post history.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileImage,
  Globe,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
  AlertTriangle,
  X,
  Eye,
} from 'lucide-react';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import {
  useSocialStore,
  PLATFORM_META,
  adaptForPlatform,
  type SocialPlatform,
  type PostRecord,
  type MediaItem,
} from '@/state/socialStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBaseUrl(): string {
  try {
    return resolveWorkbenchApiBaseUrl();
  } catch {
    return '';
  }
}

function generateId(): string {
  return `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const STATUS_BADGE: Record<PostRecord['status'], { label: string; cls: string }> = {
  draft: { label: 'draft', cls: 'border-slate-500/30 bg-slate-500/10 text-slate-400' },
  scheduled: { label: 'scheduled', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  publishing: { label: 'publishing', cls: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
  published: { label: 'published', cls: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' },
  failed: { label: 'failed', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-400' },
};

const STATUS_ICON: Record<PostRecord['status'], React.ReactNode> = {
  draft: <Clock size={11} className="text-slate-400" />,
  scheduled: <Calendar size={11} className="text-amber-400" />,
  publishing: <Loader2 size={11} className="animate-spin text-sky-400" />,
  published: <CheckCircle2 size={11} className="text-emerald-400" />,
  failed: <XCircle size={11} className="text-rose-400" />,
};

// ---------------------------------------------------------------------------
// Platform selector checkbox
// ---------------------------------------------------------------------------

interface PlatformCheckboxProps {
  platformId: SocialPlatform;
  selected: boolean;
  onToggle: () => void;
}

function PlatformCheckbox({ platformId, selected, onToggle }: PlatformCheckboxProps) {
  const meta = PLATFORM_META.find((p) => p.id === platformId);
  if (!meta) return null;
  return (
    <label
      className={[
        'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-white/5',
        selected
          ? 'border-sky-500/60 bg-sky-500/10'
          : 'theme-border theme-bg-primary',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="shrink-0 accent-sky-500"
      />
      <span className={selected ? 'text-[10px] font-semibold text-sky-400' : 'text-[10px] font-semibold theme-text-primary'}>
        {meta.label}
      </span>
      <span className="ml-auto text-[9px] theme-text-muted">{meta.charLimit.toLocaleString()}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Platform preview card
// ---------------------------------------------------------------------------

interface PlatformPreviewCardProps {
  platformId: SocialPlatform;
  originalText: string;
}

function PlatformPreviewCard({ platformId, originalText }: PlatformPreviewCardProps) {
  const meta = PLATFORM_META.find((p) => p.id === platformId);
  if (!meta) return null;
  const adapted = adaptForPlatform(originalText, meta);
  const overLimit = adapted.length > meta.charLimit;
  const charPct = Math.min(100, Math.round((adapted.length / meta.charLimit) * 100));

  return (
    <div className="rounded-lg border theme-border theme-bg-primary px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold theme-text-primary">{meta.label}</p>
        <span
          className={[
            'text-[10px] font-semibold',
            overLimit ? 'text-rose-400' : 'theme-text-muted',
          ].join(' ')}
        >
          {adapted.length} / {meta.charLimit.toLocaleString()}
        </span>
      </div>

      {/* Character bar */}
      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={['h-full rounded-full transition-all', overLimit ? 'bg-rose-500' : 'bg-sky-500'].join(' ')}
          style={{ width: `${charPct}%` }}
        />
      </div>

      {/* Adapted preview */}
      <pre className="whitespace-pre-wrap break-words font-sans text-[10px] leading-relaxed theme-text-secondary max-h-28 overflow-y-auto">
        {adapted || <span className="theme-text-muted italic">No content</span>}
      </pre>

      <p className="text-[9px] theme-text-muted">
        Hashtags: <span className="font-semibold theme-text-primary">{meta.hashtagStyle}</span>
        {' · '}
        Media: <span className="font-semibold theme-text-primary">{meta.supportedMediaTypes.join(', ')}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Media uploader
// ---------------------------------------------------------------------------

interface MediaUploaderProps {
  items: MediaItem[];
  onAdd: (item: MediaItem) => void;
  onRemove: (id: string) => void;
}

function MediaUploader({ items, onAdd, onRemove }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      const mediaItem: MediaItem = {
        id: generateId(),
        name: file.name,
        url,
        type: file.type.startsWith('video') ? 'video' : 'image',
        uploadedAt: Date.now(),
      };
      onAdd(mediaItem);
    }
  };

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop image or video files here, or click to browse"
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          dragging
            ? 'border-sky-500/60 bg-sky-500/5'
            : 'theme-border hover:border-sky-500/40 hover:bg-white/[0.02]',
        ].join(' ')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <FileImage size={20} className="theme-text-muted" />
        <p className="text-[10px] theme-text-secondary">
          Drag & drop images / videos or click to browse
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          title="Upload media files"
        />
      </div>

      {/* Uploaded items */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-lg border theme-border theme-bg-primary px-2 py-1.5 flex items-center gap-2"
            >
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={item.name}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded bg-sky-500/10">
                  <Globe size={12} className="text-sky-400" />
                </div>
              )}
              <p className="max-w-[80px] truncate text-[10px] theme-text-primary">{item.name}</p>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                title={`Remove ${item.name}`}
                className="shrink-0 rounded-full p-0.5 text-rose-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/20 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <X size={9} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post history row
// ---------------------------------------------------------------------------

function PostHistoryRow({ post }: { post: PostRecord }) {
  const badge = STATUS_BADGE[post.status];
  return (
    <div className="flex items-start gap-2 rounded-lg border theme-border theme-bg-primary px-3 py-2">
      <span className="mt-0.5 shrink-0">{STATUS_ICON[post.status]}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs theme-text-primary">{post.text}</p>
        <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] theme-text-muted">
          <span>{post.platforms.length} platform{post.platforms.length !== 1 ? 's' : ''}</span>
          {post.scheduledAt && (
            <span>Scheduled: {new Date(post.scheduledAt).toLocaleString()}</span>
          )}
          {post.publishedAt && (
            <span>Published: {new Date(post.publishedAt).toLocaleString()}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <span
          className={`rounded-full border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ${badge.cls}`}
        >
          {badge.label}
        </span>
        {post.link && (
          <a
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            title="View published post"
            className="text-[10px] text-sky-400 underline hover:text-sky-300"
          >
            View
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-tab type
// ---------------------------------------------------------------------------

type SocialSubTab = 'compose' | 'preview' | 'history';

const SOCIAL_SUBTABS: Array<{ key: SocialSubTab; label: string }> = [
  { key: 'compose', label: 'Compose' },
  { key: 'preview', label: 'Preview' },
  { key: 'history', label: 'History' },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * SocialPostComposer — compose, preview, schedule, and track posts across
 * 14 social platforms using ContentAdaptationEngine rules for per-platform
 * content variants.
 *
 * POST /api/social/compose   — immediate publish.
 * POST /api/social/schedule  — scheduled publish.
 * GET  /api/social/posts     — post history.
 */
export function SocialPostComposer() {
  const [subTab, setSubTab] = useState<SocialSubTab>('compose');
  const [submitting, setSubmitting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const draftText = useSocialStore((s) => s.draftText);
  const selectedPlatforms = useSocialStore((s) => s.selectedPlatforms);
  const mediaItems = useSocialStore((s) => s.mediaItems);
  const posts = useSocialStore((s) => s.posts);
  const scheduledAt = useSocialStore((s) => s.scheduledAt);

  const setDraftText = useSocialStore((s) => s.setDraftText);
  const togglePlatform = useSocialStore((s) => s.togglePlatform);
  const addMedia = useSocialStore((s) => s.addMedia);
  const removeMedia = useSocialStore((s) => s.removeMedia);
  const addPost = useSocialStore((s) => s.addPost);
  const setPosts = useSocialStore((s) => s.setPosts);
  const setScheduledAt = useSocialStore((s) => s.setScheduledAt);

  // Load post history on mount
  const loadPosts = useCallback(async (silent = false) => {
    if (!silent) setLoadingPosts(true);
    try {
      const base = buildBaseUrl();
      const res = await fetch(`${base}/api/social/posts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { posts?: PostRecord[] };
      setPosts(data.posts ?? []);
    } catch {
      // Backend may be unavailable; retain local history
    } finally {
      setLoadingPosts(false);
    }
  }, [setPosts]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  // -------------------------------------------------------------------------
  // Publish / Schedule
  // -------------------------------------------------------------------------

  const handlePublish = async (scheduled: boolean) => {
    if (!draftText.trim() || selectedPlatforms.size === 0) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const platforms = Array.from(selectedPlatforms);
    const variants: Partial<Record<SocialPlatform, string>> = {};
    for (const pid of platforms) {
      const meta = PLATFORM_META.find((m) => m.id === pid);
      if (meta) variants[pid] = adaptForPlatform(draftText, meta);
    }

    const postId = generateId();
    const newPost: PostRecord = {
      id: postId,
      text: draftText,
      platforms,
      status: scheduled ? 'scheduled' : 'publishing',
      scheduledAt: scheduled ? scheduledAt : null,
      publishedAt: null,
      link: null,
      mediaUrls: mediaItems.map((m) => m.url),
      variants,
    };
    addPost(newPost);

    try {
      const base = buildBaseUrl();
      const endpoint = scheduled ? '/api/social/schedule' : '/api/social/compose';
      const res = await fetch(`${base}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: draftText,
          platforms,
          variants,
          scheduledAt: scheduled ? scheduledAt : undefined,
          mediaUrls: mediaItems.map((m) => m.url),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { postId?: string; link?: string };
      // Update local record with published state
      const updatedPost: Partial<PostRecord> = scheduled
        ? { status: 'scheduled' }
        : { status: 'published', publishedAt: Date.now(), link: data.link ?? null };
      setPosts(
        posts
          .map((p) => (p.id === postId ? { ...p, ...updatedPost } : p))
          .concat(posts.find((p) => p.id === postId) ? [] : [{ ...newPost, ...updatedPost }])
      );
      setSuccess(scheduled ? 'Post scheduled.' : 'Post published successfully.');
      setDraftText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed.');
      setPosts(
        posts.map((p) => (p.id === postId ? { ...p, status: 'failed' } : p))
      );
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const selectedList = Array.from(selectedPlatforms);

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Social</p>
            <h3 className="text-sm font-semibold theme-text-primary">Post Composer</h3>
          </div>
          <HelpTooltip label="Explain social post composer" side="bottom">
            Compose a post, select target platforms, preview per-platform adaptations (character
            limits, hashtag grouping), attach media, and publish immediately or schedule. The
            ContentAdaptationEngine automatically generates platform-specific variants.
          </HelpTooltip>
        </div>
        <button
          type="button"
          onClick={() => void loadPosts()}
          disabled={loadingPosts}
          title="Refresh post history from backend."
          className="inline-flex items-center gap-1 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[10px] theme-text-secondary transition hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RefreshCw size={9} className={loadingPosts ? 'animate-spin' : ''} />
          {loadingPosts ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {/* Banners */}
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-400">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-400">
          <CheckCircle2 size={11} className="mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="mb-4 flex gap-0.5 overflow-x-auto rounded-lg border theme-border theme-bg-primary p-0.5">
        {SOCIAL_SUBTABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={[
              'shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              subTab === key
                ? 'bg-sky-500 text-white'
                : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Compose tab                                                          */}
      {/* ------------------------------------------------------------------ */}
      {subTab === 'compose' && (
        <div className="space-y-4">
          {/* Post text */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Post</p>
            <textarea
              rows={5}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="What's on your mind? Use #hashtags and @mentions freely…"
              title="Compose your post"
              className="w-full resize-none rounded-md border theme-border theme-bg-primary px-2.5 py-2 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
            />
            <p className="mt-0.5 text-right text-[9px] theme-text-muted">
              {draftText.length} chars
            </p>
          </div>

          {/* Platform selector */}
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Target Platforms
            </p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {PLATFORM_META.map((meta) => (
                <PlatformCheckbox
                  key={meta.id}
                  platformId={meta.id}
                  selected={selectedPlatforms.has(meta.id)}
                  onToggle={() => togglePlatform(meta.id)}
                />
              ))}
            </div>
          </div>

          {/* Media uploader */}
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Media
            </p>
            <MediaUploader
              items={mediaItems}
              onAdd={addMedia}
              onRemove={removeMedia}
            />
          </div>

          {/* Schedule toggle */}
          <div className="flex items-center gap-3 rounded-lg border theme-border theme-bg-primary px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={scheduleMode}
                onChange={(e) => setScheduleMode(e.target.checked)}
                className="shrink-0 accent-sky-500"
              />
              <span className="text-[10px] font-semibold theme-text-primary">Schedule for later</span>
            </label>
            {scheduleMode && (
              <input
                type="datetime-local"
                value={
                  scheduledAt
                    ? new Date(scheduledAt - new Date().getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16)
                    : ''
                }
                onChange={(e) =>
                  setScheduledAt(e.target.value ? new Date(e.target.value).getTime() : null)
                }
                title="Schedule date and time"
                className="ml-2 rounded-md border theme-border bg-[color:var(--color-background-secondary)] px-2 py-1 text-[10px] theme-text-primary focus:border-sky-500 focus:outline-none"
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSubTab('preview')}
              disabled={!draftText.trim() || selectedPlatforms.size === 0}
              title="Preview platform adaptations"
              className="inline-flex items-center gap-1.5 rounded-full border theme-border theme-bg-primary px-4 py-1.5 text-[10px] font-medium theme-text-secondary transition hover:bg-white/5 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Eye size={10} />
              Preview
            </button>

            {scheduleMode ? (
              <button
                type="button"
                onClick={() => void handlePublish(true)}
                disabled={submitting || !draftText.trim() || selectedPlatforms.size === 0 || !scheduledAt}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-[10px] font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                {submitting ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Calendar size={10} />
                )}
                {submitting ? 'Scheduling…' : 'Schedule Post'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handlePublish(false)}
                disabled={submitting || !draftText.trim() || selectedPlatforms.size === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1.5 text-[10px] font-semibold text-sky-400 transition hover:bg-sky-500/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {submitting ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Send size={10} />
                )}
                {submitting
                  ? 'Posting…'
                  : `Post Now to ${selectedPlatforms.size} platform${selectedPlatforms.size !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Preview tab                                                          */}
      {/* ------------------------------------------------------------------ */}
      {subTab === 'preview' && (
        <div className="space-y-3">
          {selectedList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <Globe size={18} className="theme-text-muted" />
              <p className="text-xs theme-text-secondary">No platforms selected.</p>
              <p className="text-[10px] theme-text-muted">
                Go to Compose and select at least one platform.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedList.map((pid) => (
                <PlatformPreviewCard
                  key={pid}
                  platformId={pid}
                  originalText={draftText}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* History tab                                                          */}
      {/* ------------------------------------------------------------------ */}
      {subTab === 'history' && (
        <div className="space-y-1.5">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <Clock size={18} className="theme-text-muted" />
              <p className="text-xs theme-text-secondary">No posts yet.</p>
              <p className="text-[10px] theme-text-muted">
                Posts you compose and schedule will appear here.
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostHistoryRow key={post.id} post={post} />
            ))
          )}
        </div>
      )}
    </section>
  );
}
