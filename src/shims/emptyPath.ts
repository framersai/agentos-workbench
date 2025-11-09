/**
 * Extremely small subset of Node's `path` utilities tailored for browser builds.
 * The helpers intentionally avoid full parity and are only meant to satisfy
 * modules that perform basic path concatenation or logging.
 */
const sanitize = (segment: string): string => segment.replace(/\/{2,}/g, '/');

export const sep = '/';

export function join(...segments: string[]): string {
  return sanitize(segments.filter(Boolean).join('/'));
}

export function resolve(...segments: string[]): string {
  if (segments.length === 0) {
    return '/';
  }
  const path = join(...segments);
  return path.startsWith('/') ? path : `/${path}`;
}

export function dirname(value: string): string {
  const normalized = sanitize(value);
  const parts = normalized.split('/');
  parts.pop();
  return parts.length > 0 ? parts.join('/') || '/' : '/';
}

export function basename(value: string): string {
  const normalized = sanitize(value);
  const parts = normalized.split('/');
  return parts.pop() ?? normalized;
}

export function extname(value: string): string {
  const base = basename(value);
  const index = base.lastIndexOf('.');
  return index >= 0 ? base.slice(index) : '';
}

export default {
  sep,
  join,
  resolve,
  dirname,
  basename,
  extname,
};
