import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  const home = { admin: '/admin', staff: '/staff', donor: '/donor' }[user?.role] || '/login';
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>🩸</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a' }}>404 — Page Not Found</h1>
        <p style={{ color: '#64748b', marginBottom: 24 }}>The page you're looking for doesn't exist.</p>
        <Link to={home} className="btn-bb-primary" style={{ textDecoration: 'none' }}>← Go Back Home</Link>
      </div>
    </div>
  );
}
