import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { downloadUrl } from '../api/client.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import StorageBar from '../components/StorageBar.jsx';
import FileGrid from '../components/FileGrid.jsx';
import UploadButton from '../components/UploadButton.jsx';
import ContextMenu from '../components/ContextMenu.jsx';
import Modal from '../components/Modal.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import MoveDialog from '../components/MoveDialog.jsx';
import PreviewModal from '../components/PreviewModal.jsx';
import { isPreviewable } from '../utils.js';

export default function Drive() {
  const { folderId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState({ folders: [], files: [], breadcrumb: [], page: 1, pages: 1 });
  const [storage, setStorage] = useState({ used: 0, quota: 1, percent: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState(() => localStorage.getItem('view') || 'grid');

  const [menu, setMenu] = useState(null); // {x,y,item,isFolder}
  const [dialog, setDialog] = useState(null); // {type, item, isFolder}
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState('');

  const searchTimer = useRef(null);

  const parentParam = folderId || 'root';

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, storageRes] = await Promise.all([
        api.get('/files', { params: { parentId: parentParam, search, page, limit: 24 } }),
        api.get('/storage'),
      ]);
      setData(listRes.data);
      setStorage(storageRes.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load this folder');
    } finally {
      setLoading(false);
    }
  }, [parentParam, search, page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reset to page 1 when the folder or search changes.
  useEffect(() => {
    setPage(1);
  }, [folderId, search]);

  const onSearchChange = (v) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v), 300);
  };

  const setViewMode = (v) => {
    setView(v);
    localStorage.setItem('view', v);
  };

  // --- item actions ---
  const openItem = (item, isFolder) => {
    if (isFolder) {
      navigate(`/folder/${item._id}`);
    } else if (isPreviewable(item.mimeType)) {
      setDialog({ type: 'preview', item });
    } else {
      downloadFile(item);
    }
  };

  const openMenu = (e, item, isFolder) => {
    setMenu({ x: e.clientX, y: e.clientY, item, isFolder });
  };

  const downloadFile = (item) => {
    const a = document.createElement('a');
    a.href = downloadUrl(item._id);
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/folders', {
        name: newFolderName.trim(),
        parentId: parentParam,
      });
      setNewFolderName('');
      setDialog(null);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create folder');
    }
  };

  const doRename = async () => {
    const { item, isFolder } = dialog;
    if (!renameValue.trim()) return;
    try {
      const path = isFolder ? `/folders/${item._id}` : `/files/${item._id}`;
      await api.patch(path, { name: renameValue.trim() });
      setDialog(null);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Rename failed');
    }
  };

  const doDelete = async (item, isFolder) => {
    try {
      await api.delete(isFolder ? `/folders/${item._id}` : `/files/${item._id}`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const menuItems = menu
    ? [
        ...(menu.isFolder
          ? [{ label: 'Open', icon: '📂', onClick: () => openItem(menu.item, true) }]
          : [
              { label: 'Download', icon: '⬇', onClick: () => downloadFile(menu.item) },
              ...(isPreviewable(menu.item.mimeType)
                ? [
                    {
                      label: 'Preview',
                      icon: '👁',
                      onClick: () => setDialog({ type: 'preview', item: menu.item }),
                    },
                  ]
                : []),
            ]),
        {
          label: 'Rename',
          icon: '✏️',
          onClick: () => {
            setRenameValue(menu.item.name);
            setDialog({ type: 'rename', item: menu.item, isFolder: menu.isFolder });
          },
        },
        {
          label: 'Move',
          icon: '📦',
          onClick: () => setDialog({ type: 'move', item: menu.item, isFolder: menu.isFolder }),
        },
        {
          label: 'Share',
          icon: '🔗',
          onClick: () => setDialog({ type: 'share', item: menu.item, isFolder: menu.isFolder }),
        },
        null,
        {
          label: 'Delete',
          icon: '🗑',
          danger: true,
          onClick: () => doDelete(menu.item, menu.isFolder),
        },
      ]
    : [];

  const isEmpty = !loading && data.folders.length === 0 && data.files.length === 0;

  return (
    <div className="page">
      <div className="toolbar">
        <Breadcrumb trail={data.breadcrumb} />
        <div className="toolbar-actions">
          <input
            className="input"
            style={{ width: 200 }}
            placeholder="Search…"
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div className="pageview">
            <button
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Grid"
            >
              ▦
            </button>
            <button
              className={view === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="List"
            >
              ☰
            </button>
          </div>
          <button
            className="btn"
            onClick={() => {
              setNewFolderName('');
              setDialog({ type: 'newFolder' });
            }}
          >
            ＋ New Folder
          </button>
          <UploadButton
            parentId={folderId || null}
            onUploaded={refresh}
          />
        </div>
      </div>

      <StorageBar {...storage} />

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="center-load">
          <span className="spinner" />
        </div>
      ) : isEmpty ? (
        <div className="empty">
          <div className="big">🗂️</div>
          <p>This folder is empty. Upload a file or create a folder to get started.</p>
        </div>
      ) : (
        <>
          <FileGrid
            folders={data.folders}
            files={data.files}
            view={view}
            onOpen={openItem}
            onMenu={openMenu}
          />
          {data.pages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span>
                Page {data.page} of {data.pages}
              </span>
              <button
                className="btn btn-sm"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {dialog?.type === 'newFolder' && (
        <Modal
          title="New folder"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={createFolder}>
                Create
              </button>
            </>
          }
        >
          <label className="field">
            <span>Folder name</span>
            <input
              className="input"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
            />
          </label>
        </Modal>
      )}

      {dialog?.type === 'rename' && (
        <Modal
          title="Rename"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={doRename}>
                Save
              </button>
            </>
          }
        >
          <label className="field">
            <span>New name</span>
            <input
              className="input"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doRename()}
            />
          </label>
        </Modal>
      )}

      {dialog?.type === 'move' && (
        <MoveDialog
          item={dialog.item}
          itemType={dialog.isFolder ? 'folder' : 'file'}
          onClose={() => setDialog(null)}
          onMoved={refresh}
        />
      )}

      {dialog?.type === 'share' && (
        <ShareDialog
          resource={dialog.item}
          resourceType={dialog.isFolder ? 'folder' : 'file'}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === 'preview' && (
        <PreviewModal file={dialog.item} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
