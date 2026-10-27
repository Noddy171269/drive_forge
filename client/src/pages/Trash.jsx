import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { iconFor, formatBytes } from '../utils.js';

export default function Trash() {
  const [data, setData] = useState({ files: [], folders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/trash');
      setData(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load trash');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const restore = async (item, isFolder) => {
    try {
      await api.post(isFolder ? `/folders/${item._id}/restore` : `/files/${item._id}/restore`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Restore failed');
    }
  };

  const deleteForever = async (item, isFolder) => {
    if (!window.confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/trash/${item._id}`, {
        params: { type: isFolder ? 'folder' : 'file' },
      });
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const rows = [
    ...data.folders.map((f) => ({ item: f, isFolder: true })),
    ...data.files.map((f) => ({ item: f, isFolder: false })),
  ];

  return (
    <div className="page">
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Trash</h2>
      </div>
      <p style={{ color: 'var(--text-dim)', marginTop: -8 }}>
        Restore items, or delete them forever to free up storage.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="center-load">
          <span className="spinner" />
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="big">🗑️</div>
          <p>Trash is empty.</p>
        </div>
      ) : (
        <div className="row-list">
          {rows.map(({ item, isFolder }) => (
            <div key={item._id} className="file-row" style={{ cursor: 'default' }}>
              <span className="icon">{iconFor(item.mimeType, isFolder)}</span>
              <span className="name">{item.name}</span>
              <span className="sub">{isFolder ? 'Folder' : formatBytes(item.size)}</span>
              <button className="btn btn-sm" onClick={() => restore(item, isFolder)}>
                Restore
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => deleteForever(item, isFolder)}
              >
                Delete forever
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
