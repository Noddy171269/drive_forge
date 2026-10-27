import Modal from './Modal.jsx';
import { downloadUrl } from '../api/client.js';
import { isPreviewable } from '../utils.js';

/**
 * Preview modal. Video uses a native <video controls> pointed at the download
 * endpoint so the browser issues HTTP Range requests (visibly demonstrating
 * server-side streaming/seeking). Images render inline; other types offer a
 * download.
 */
export default function PreviewModal({ file, onClose }) {
  const url = downloadUrl(file._id);
  const mime = file.mimeType || '';

  return (
    <Modal title={file.name} onClose={onClose} wide>
      <div style={{ textAlign: 'center' }}>
        {mime.startsWith('image/') && (
          <img
            src={url}
            alt={file.name}
            style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 10 }}
          />
        )}
        {mime.startsWith('video/') && (
          <video
            src={url}
            controls
            autoPlay
            style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 10 }}
          />
        )}
        {mime.startsWith('audio/') && <audio src={url} controls style={{ width: '100%' }} />}
        {!isPreviewable(mime) && (
          <div style={{ padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <p style={{ color: 'var(--text-dim)' }}>No inline preview for this file type.</p>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <a className="btn btn-primary" href={url} download={file.name}>
            ⬇ Download
          </a>
        </div>
      </div>
    </Modal>
  );
}
