import { iconFor, formatBytes } from '../utils.js';
import FileRow from './FileRow.jsx';

/** A single card in grid view. */
function Card({ item, isFolder, onOpen, onMenu }) {
  return (
    <div
      className="card"
      onDoubleClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e);
      }}
    >
      <button
        className="menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          onMenu(e);
        }}
        aria-label="Menu"
      >
        ⋯
      </button>
      <span className="icon">{iconFor(item.mimeType, isFolder)}</span>
      <div className="name">{item.name}</div>
      <div className="sub">{isFolder ? 'Folder' : formatBytes(item.size)}</div>
    </div>
  );
}

/**
 * Renders folders then files. onOpen(item, isFolder), onMenu(e, item, isFolder).
 */
export default function FileGrid({ folders, files, view, onOpen, onMenu }) {
  if (view === 'list') {
    return (
      <div className="row-list">
        {folders.map((f) => (
          <FileRow
            key={`fo-${f._id}`}
            item={f}
            isFolder
            onOpen={() => onOpen(f, true)}
            onMenu={(e) => onMenu(e, f, true)}
          />
        ))}
        {files.map((f) => (
          <FileRow
            key={`fi-${f._id}`}
            item={f}
            isFolder={false}
            onOpen={() => onOpen(f, false)}
            onMenu={(e) => onMenu(e, f, false)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid">
      {folders.map((f) => (
        <Card
          key={`fo-${f._id}`}
          item={f}
          isFolder
          onOpen={() => onOpen(f, true)}
          onMenu={(e) => onMenu(e, f, true)}
        />
      ))}
      {files.map((f) => (
        <Card
          key={`fi-${f._id}`}
          item={f}
          isFolder={false}
          onOpen={() => onOpen(f, false)}
          onMenu={(e) => onMenu(e, f, false)}
        />
      ))}
    </div>
  );
}
