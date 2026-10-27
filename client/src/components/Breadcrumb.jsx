import { useNavigate } from 'react-router-dom';

/** trail: array of { id, name }, outermost first. */
export default function Breadcrumb({ trail = [] }) {
  const navigate = useNavigate();

  return (
    <nav className="breadcrumb">
      <button onClick={() => navigate('/')}>Home</button>
      {trail.map((f, i) => (
        <span key={f.id} style={{ display: 'contents' }}>
          <span className="sep">/</span>
          {i === trail.length - 1 ? (
            <span className="current">{f.name}</span>
          ) : (
            <button onClick={() => navigate(`/folder/${f.id}`)}>{f.name}</button>
          )}
        </span>
      ))}
    </nav>
  );
}
