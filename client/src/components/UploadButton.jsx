import { useRef, useState } from 'react';
import api from '../api/client.js';

/**
 * Upload button with a real progress bar (axios onUploadProgress) and a cancel
 * action via AbortController.
 */
export default function UploadButton({ parentId, onUploaded }) {
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const [progress, setProgress] = useState(null); // null = idle
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const pick = () => inputRef.current?.click();

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    setError('');
    setFileName(file.name);
    setProgress(0);

    const form = new FormData();
    form.append('file', file);
    if (parentId) form.append('parentId', parentId);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await api.post('/files/upload', form, {
        signal: controller.signal,
        onUploadProgress: (evt) => {
          if (evt.total) {
            setProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        },
      });
      setProgress(null);
      setFileName('');
      onUploaded?.();
    } catch (err) {
      if (api.isCancel?.(err) || err.code === 'ERR_CANCELED') {
        setProgress(null);
        setFileName('');
        return;
      }
      setError(err.response?.data?.message || 'Upload failed');
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <button className="btn btn-primary" onClick={pick} disabled={progress !== null}>
        ⬆ Upload
      </button>

      {progress !== null && (
        <div className="upload-toast">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fileName}
            </span>
            <strong>{progress}%</strong>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${progress}%` }} />
          </div>
          <button className="btn btn-sm" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="upload-toast" style={{ borderColor: 'rgba(255,107,107,0.4)' }}>
          <div className="error-banner" style={{ margin: 0 }}>
            {error}
          </div>
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
