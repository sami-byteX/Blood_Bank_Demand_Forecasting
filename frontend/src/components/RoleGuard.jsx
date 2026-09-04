import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// roles: array of allowed roles e.g. ['admin', 'staff']
export default function RoleGuard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    // Redirect to the correct home for this role
    const home = { admin: '/admin', staff: '/staff', donor: '/donor' }[user.role] || '/login';
    return <Navigate to={home} replace />;
  }
  return children;
}
