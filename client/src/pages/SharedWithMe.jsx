import { useEffect, useState } from 'react';
import api, { downloadUrl } from '../api/client.js';
import { iconFor, formatBytes, isPreviewable } from '../utils.js';
import PreviewModal from '../components/PreviewModal.jsx';

export default function SharedWithMe() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/shares/shared-with-me');
        setItems(data.items);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load shared items');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const open = (entry) => {
    const { resource, resourceType } = entry;
    if (resourceType === 'file') {
      if (isPreviewable(resource.mimeType)) setPreview(resource);
      else {
        const a = document.createElement('a');
        a.href = downloadUrl(resource._id);
        a.download = resource.name;
        a.click();
      }
    }
  };

  return (
    <div className="page">
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Shared with me</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="center-load">
          <span className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="big">🤝</div>
          <p>Nothing has been shared with you yet.</p>
        </div>
      ) : (
        <div className="row-list">
          {items.map((entry) => (
            <div
              key={entry.shareId}
              className="file-row"
              onDoubleClick={() => open(entry)}
            >
              <span className="icon">
                {iconFor(entry.resource.mimeType, entry.resourceType === 'folder')}
              </span>
              <span className="name">{entry.resource.name}</span>
              <span className="sub">from {entry.sharedBy}</span>
              <span className="pill">{entry.role}</span>
              {entry.resourceType === 'file' && (
                <button className="btn btn-sm" onClick={() => open(entry)}>
                  {isPreviewable(entry.resource.mimeType) ? 'Open' : 'Download'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
