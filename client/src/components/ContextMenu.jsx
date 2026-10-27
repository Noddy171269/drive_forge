import { useEffect, useRef } from 'react';

/**
 * A floating menu anchored at {x, y}. Items: {label, icon, danger, onClick}.
 * A null item renders a divider.
 */
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Keep the menu on screen.
  const style = {
    left: Math.min(x, window.innerWidth - 190),
    top: Math.min(y, window.innerHeight - items.length * 40 - 20),
  };

  return (
    <div className="context-menu" style={style} ref={ref}>
      {items.map((it, i) =>
        it === null ? (
          <div key={`d${i}`} className="divider" />
        ) : (
          <button
            key={it.label}
            className={it.danger ? 'danger' : ''}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            <span>{it.icon}</span>
            {it.label}
          </button>
        )
      )}
    </div>
  );
}
