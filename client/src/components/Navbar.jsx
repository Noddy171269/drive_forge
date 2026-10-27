import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="brand">
        <span className="logo">D</span>
        <span>Drive</span>
      </div>
      <div className="nav-links">
        <NavLink to="/" end>
          My Drive
        </NavLink>
        <NavLink to="/shared">Shared with me</NavLink>
        <NavLink to="/trash">Trash</NavLink>
      </div>
      <div className="nav-user">
        <span className="email">{user?.email}</span>
        <button className="btn btn-sm" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}
