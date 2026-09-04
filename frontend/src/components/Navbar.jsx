import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TITLES = {
  '/admin': 'Admin Dashboard',
  '/admin/users': 'User Management',
  '/staff': 'Staff Dashboard',
  '/staff/verify-donor': 'Donor Verification',
  '/staff/donations': 'Donations',
  '/staff/requests': 'Blood Requests',
  '/staff/issuance': 'Blood Issuance',
  '/staff/inventory': 'Inventory Management',
  '/staff/forecasting': 'Demand Forecasting',
  '/donor': 'Donor Dashboard',
  '/donor/profile': 'My Profile',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const title = TITLES[pathname] || 'Blood Bank Management';

  return (
    <header className="bb-topbar">
      <span className="bb-topbar-title">{title}</span>
      {user && (
        <div className="bb-topbar-user">
          <span>👤 <strong>{user.full_name}</strong></span>
          <span className="role-badge">{user.role}</span>
        </div>
      )}
    </header>
  );
}
