import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { publicDownloadUrl } from '../api/client.js';
import { iconFor, formatBytes, isPreviewable } from '../utils.js';

/**
 * Public landing page for a shared link (/s/:token). Resolves the share
 * unauthenticated; for files it previews/downloads via the share token.
 */
export default function PublicShare() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/shares/${token}`);
        setState({ loading: false, data });
      } catch (err) {
        setState({
          loading: false,
          error: err.response?.data?.message || 'This link is not available',
          status: err.response?.status,
        });
      }
    })();
  }, [token]);

  if (state.loading) {
    return (
      <div className="center-load">
        <span className="spinner" />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🔒</div>
          <h1>Link unavailable</h1>
          <p className="sub">{state.error}</p>
          <Link className="btn btn-primary" to="/">
            Go to Drive
          </Link>
        </div>
      </div>
    );
  }

  const { resourceType, role } = state.data;
  const resource = state.data[resourceType];
  const url = resourceType === 'file' ? publicDownloadUrl(resource._id, token) : null;

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 560, textAlign: 'center' }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <span className="logo">D</span>
          <span>Drive</span>
        </div>
        <div style={{ fontSize: 48 }}>
          {iconFor(resource.mimeType, resourceType === 'folder')}
        </div>
        <h1 style={{ marginBottom: 4 }}>{resource.name}</h1>
        <p className="sub">
          Shared {resourceType} · <span className="pill">{role}</span>
          {resourceType === 'file' && ` · ${formatBytes(resource.size)}`}
        </p>

        {resourceType === 'file' && isPreviewable(resource.mimeType) && (
          <div style={{ margin: '18px 0' }}>
            {resource.mimeType.startsWith('image/') && (
              <img
                src={url}
                alt={resource.name}
                style={{ maxWidth: '100%', maxHeight: '45vh', borderRadius: 10 }}
              />
            )}
            {resource.mimeType.startsWith('video/') && (
              <video
                src={url}
                controls
                style={{ maxWidth: '100%', maxHeight: '45vh', borderRadius: 10 }}
              />
            )}
            {resource.mimeType.startsWith('audio/') && (
              <audio src={url} controls style={{ width: '100%' }} />
            )}
          </div>
        )}

        {resourceType === 'file' ? (
          <a className="btn btn-primary" href={url} download={resource.name}>
            ⬇ Download
          </a>
        ) : (
          <p className="sub">This is a shared folder. Sign in to browse its contents.</p>
        )}
      </div>
    </div>
  );
}
