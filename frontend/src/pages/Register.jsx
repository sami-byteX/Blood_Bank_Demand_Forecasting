import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { extractError } from '../utils/helpers';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', password2: '' });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    if (!form.full_name.trim())  return 'Full name is required.';
    if (!form.email.trim())      return 'Email address is required.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.password2) return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    try {
      await api.post('/auth/register/', form);
      setSuccess('Registration successful. Please login.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">🩸</div>
          <h2>Register as Donor</h2>
          <p>Create your blood donor account</p>
        </div>

        {success ? (
          <div className="bb-alert success" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
            <strong>{success}</strong>
            <p style={{ fontSize: 13, color: '#166534', marginTop: 6, marginBottom: 0 }}>
              Redirecting to login…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="bb-form-label">Full Name</label>
              <input
                type="text"
                className="bb-form-control"
                placeholder="Ahmed Khan"
                value={form.full_name}
                onChange={handleChange('full_name')}
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="bb-form-label">Email Address</label>
              <input
                type="email"
                className="bb-form-control"
                placeholder="ahmed@example.com"
                value={form.email}
                onChange={handleChange('email')}
              />
            </div>

            <div className="mb-3">
              <label className="bb-form-label">Password</label>
              <input
                type="password"
                className="bb-form-control"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={handleChange('password')}
              />
            </div>

            <div className="mb-3">
              <label className="bb-form-label">Confirm Password</label>
              <input
                type="password"
                className="bb-form-control"
                placeholder="Repeat your password"
                value={form.password2}
                onChange={handleChange('password2')}
              />
            </div>

            {error && (
              <div className="bb-alert danger mb-3">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-bb-primary w-100 justify-content-center"
              disabled={loading}
            >
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2" />Registering…</>
                : '✅ Create Account'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#dc3545', fontWeight: 600 }}>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
