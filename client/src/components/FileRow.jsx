import { iconFor, formatBytes, timeAgo } from '../utils.js';

/** A single row in list view. */
export default function FileRow({ item, isFolder, onOpen, onMenu }) {
  return (
    <div
      className="file-row"
      onDoubleClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e);
      }}
    >
      <span className="icon">{iconFor(item.mimeType, isFolder)}</span>
      <span className="name">{item.name}</span>
      <span className="sub">
        {isFolder ? 'Folder' : formatBytes(item.size)}
      </span>
      <span className="sub">{timeAgo(item.updatedAt || item.createdAt)}</span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={(e) => {
          e.stopPropagation();
          onMenu(e);
        }}
      >
        ⋯
      </button>
    </div>
  );
}
