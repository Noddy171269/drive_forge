export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function iconFor(mimeType = '', isFolder = false) {
  if (isFolder) return '📁';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎞️';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.startsWith('text/')) return '📄';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️';
  if (mimeType.includes('json') || mimeType.includes('javascript')) return '🧩';
  return '📦';
}

export function isPreviewable(mimeType = '') {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/');
}

export function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
