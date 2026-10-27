import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const DEMOS = [
  { email: 'alice@example.com', label: 'Alice' },
  { email: 'bob@example.com', label: 'Bob' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 20 }}>
          <span className="logo">D</span>
          <span>Drive</span>
        </div>
        <h1>Welcome back</h1>
        <p className="sub">Sign in to your cloud drive</p>

        <div className="demo-fills">
          {DEMOS.map((d) => (
            <button
              key={d.email}
              type="button"
              className="btn btn-sm"
              onClick={() => fillDemo(d.email)}
            >
              Use {d.label}
            </button>
          ))}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="switch-line">
          No account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
