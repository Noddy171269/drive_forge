import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Drive from './pages/Drive.jsx';
import Trash from './pages/Trash.jsx';
import SharedWithMe from './pages/SharedWithMe.jsx';
import PublicShare from './pages/PublicShare.jsx';

function Shell({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="center-load">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/s/:token" element={<PublicShare />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Shell>
              <Drive />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/folder/:folderId"
        element={
          <ProtectedRoute>
            <Shell>
              <Drive />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/trash"
        element={
          <ProtectedRoute>
            <Shell>
              <Trash />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/shared"
        element={
          <ProtectedRoute>
            <Shell>
              <SharedWithMe />
            </Shell>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
