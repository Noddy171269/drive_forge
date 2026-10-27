import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import api from '../api/client.js';

/**
 * Lets the user pick a destination folder by browsing their folder tree one
 * level at a time. "Move here" targets the currently browsed folder.
 */
export default function MoveDialog({ item, itemType, onClose, onMoved }) {
  const [parentId, setParentId] = useState(null); // currently browsed folder
  const [trail, setTrail] = useState([]); // [{id,name}]
  const [folders, setFolders] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (pid) => {
    const { data } = await api.get('/files', {
      params: { parentId: pid || 'root', limit: 100 },
    });
    // Don't allow moving a folder into itself.
    setFolders(data.folders.filter((f) => String(f._id) !== String(item._id)));
    setTrail(data.breadcrumb || []);
  };

  useEffect(() => {
    load(parentId).catch(() => setError('Could not load folders'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId]);

  const move = async () => {
    setBusy(true);
    setError('');
    try {
      const path = itemType === 'folder' ? `/folders/${item._id}` : `/files/${item._id}`;
      await api.patch(path, { parentId: parentId || 'root' });
      onMoved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Move failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Move "${item.name}"`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={move} disabled={busy}>
            Move here
          </button>
        </>
      }
    >
      {error && <div className="error-banner">{error}</div>}

      <div className="breadcrumb" style={{ marginBottom: 14 }}>
        <button onClick={() => setParentId(null)}>Home</button>
        {trail.map((f, i) => (
          <span key={f.id} style={{ display: 'contents' }}>
            <span className="sep">/</span>
            {i === trail.length - 1 ? (
              <span className="current">{f.name}</span>
            ) : (
              <button onClick={() => setParentId(f.id)}>{f.name}</button>
            )}
          </span>
        ))}
      </div>

      <div className="row-list">
        {folders.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>No subfolders here.</p>
        )}
        {folders.map((f) => (
          <div
            key={f._id}
            className="file-row"
            onClick={() => setParentId(f._id)}
            style={{ cursor: 'pointer' }}
          >
            <span className="icon">📁</span>
            <span className="name">{f.name}</span>
            <span className="sub">Open →</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
