import { formatBytes } from '../utils.js';

export default function StorageBar({ used = 0, quota = 1, percent = 0 }) {
  return (
    <div className="storage-bar">
      <div className="meta">
        <strong style={{ color: 'var(--text)' }}>Storage</strong>
        <span>{percent}% used</span>
      </div>
      <div className="track">
        <div
          className="fill"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="meta">
        <span>{formatBytes(used)} used</span>
        <span>{formatBytes(quota)} total</span>
      </div>
    </div>
  );
}
