import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import api from '../api/client.js';

const EXPIRY_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 168 },
  { label: 'Never', hours: '' },
];

export default function ShareDialog({ resource, resourceType, onClose }) {
  const [tab, setTab] = useState('user');

  // user-share state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [userMsg, setUserMsg] = useState(null);

  // public-link state
  const [expiry, setExpiry] = useState(24);
  const [publicLinks, setPublicLinks] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);

  const loadLinks = async () => {
    try {
      const { data } = await api.get('/shares/mine');
      const mine = data.shares.filter(
        (s) =>
          String(s.resourceId) === String(resource._id) &&
          s.token &&
          !s.revoked
      );
      setPublicLinks(mine);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareWithUser = async (e) => {
    e.preventDefault();
    setError('');
    setUserMsg(null);
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.post('/shares', {
        resourceId: resource._id,
        resourceType,
        recipientEmail: email.trim(),
        role,
      });
      setUserMsg(`Shared with ${email.trim()} as ${role}.`);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not share');
    } finally {
      setBusy(false);
    }
  };

  const createLink = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post('/shares', {
        resourceId: resource._id,
        resourceType,
        role: 'viewer',
        expiresInHours: expiry === '' ? undefined : expiry,
      });
      await loadLinks();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create link');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    setBusy(true);
    try {
      await api.post(`/shares/${id}/revoke`);
      await loadLinks();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not revoke');
    } finally {
      setBusy(false);
    }
  };

  const linkUrl = (token) => `${window.location.origin}/s/${token}`;

  const copy = async (token) => {
    try {
      await navigator.clipboard.writeText(linkUrl(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <Modal title={`Share "${resource.name}"`} onClose={onClose} wide>
      <div className="tabs">
        <button className={tab === 'user' ? 'active' : ''} onClick={() => setTab('user')}>
          Share with people
        </button>
        <button className={tab === 'link' ? 'active' : ''} onClick={() => setTab('link')}>
          Public link
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === 'user' && (
        <form onSubmit={shareWithUser}>
          <label className="field">
            <span>Recipient email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="viewer">Viewer (can view & download)</option>
              <option value="editor">Editor</option>
            </select>
          </label>
          {userMsg && (
            <div
              className="error-banner"
              style={{
                background: 'rgba(57,217,138,0.14)',
                color: 'var(--success)',
                borderColor: 'rgba(57,217,138,0.35)',
              }}
            >
              {userMsg}
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Share
          </button>
        </form>
      )}

      {tab === 'link' && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 1, marginBottom: 0 }}>
              <span>Link expires in</span>
              <select
                className="input"
                value={expiry}
                onChange={(e) =>
                  setExpiry(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.label} value={o.hours}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" onClick={createLink} disabled={busy}>
              Generate link
            </button>
          </div>

          <div className="section-title">Active links</div>
          {publicLinks.length === 0 && (
            <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>No active links yet.</p>
          )}
          {publicLinks.map((s) => (
            <div key={s._id} style={{ marginBottom: 14 }}>
              <div className="copy-row">
                <input value={linkUrl(s.token)} readOnly />
                <button className="btn btn-sm" onClick={() => copy(s.token)}>
                  {copied === s.token ? '✓ Copied' : 'Copy'}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => revoke(s._id)}>
                  Revoke
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
                {s.expiresAt
                  ? `Expires ${new Date(s.expiresAt).toLocaleString()}`
                  : 'Never expires'}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
