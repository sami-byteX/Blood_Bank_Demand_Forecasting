import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractError } from '../utils/helpers';

export default function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const homeByRole = { admin: '/admin', staff: '/staff', donor: '/donor' };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Both fields are required.'); return; }
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(homeByRole[user.role] || '/login', { replace: true });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">🩸</div>
          <h2>Blood Bank Management</h2>
          <p>Hospital Blood Bank System — Secure Login</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label className="bb-form-label">Email Address</label>
            <input
              type="email"
              className={`bb-form-control${error ? ' error' : ''}`}
              placeholder="you@hospital.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label className="bb-form-label">Password</label>
            <input
              type="password"
              className={`bb-form-control${error ? ' error' : ''}`}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          {error && (
            <div className="bb-alert danger mb-3">
              <span>⚠</span> {error}
            </div>
          )}

          <button type="submit" className="btn-bb-primary w-100 justify-content-center" disabled={loading}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2" />Signing in…</>
              : '🔐 Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          New donor?{' '}
          <Link to="/register" style={{ color: '#dc3545', fontWeight: 600 }}>
            Register as Donor
          </Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
          Blood Bank Management System · FYP Project
        </p>
      </div>
    </div>
  );
}
