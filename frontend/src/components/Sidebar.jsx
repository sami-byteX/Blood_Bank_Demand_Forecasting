import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ADMIN_LINKS = [
  { section: 'Overview' },
  { to: '/admin', label: 'Dashboard', icon: '⊞', end: true },
  { section: 'Management' },
  { to: '/admin/users', label: 'User Management', icon: '👥' },
  { section: 'Operations' },
  { to: '/staff/inventory', label: 'Inventory', icon: '🩸' },
  { to: '/staff/requests', label: 'Blood Requests', icon: '📋' },
  { to: '/staff/donations', label: 'Donations', icon: '💉' },
  { to: '/staff/issuance', label: 'Issuance', icon: '📦' },
  { section: 'Analytics' },
  { to: '/staff/forecasting', label: 'Forecasting', icon: '📈' },
];

const STAFF_LINKS = [
  { section: 'Overview' },
  { to: '/staff', label: 'Dashboard', icon: '⊞', end: true },
  { section: 'Operations' },
  { to: '/staff/verify-donor', label: 'Donor Verification', icon: '🔍' },
  { to: '/staff/donations', label: 'Donations', icon: '💉' },
  { to: '/staff/requests', label: 'Blood Requests', icon: '📋' },
  { to: '/staff/issuance', label: 'Issuance', icon: '📦' },
  { section: 'Inventory' },
  { to: '/staff/inventory', label: 'Inventory', icon: '🩸' },
  { to: '/staff/forecasting', label: 'Forecasting', icon: '📈' },
];

const DONOR_LINKS = [
  { section: 'My Account' },
  { to: '/donor', label: 'Dashboard', icon: '⊞', end: true },
  { to: '/donor/profile', label: 'My Profile', icon: '👤' },
];

function linksByRole(role) {
  if (role === 'admin') return ADMIN_LINKS;
  if (role === 'staff') return STAFF_LINKS;
  return DONOR_LINKS;
}

export default function Sidebar({ pendingCount = 0 }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const links = linksByRole(user.role);
  const initials = user.full_name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <aside className="bb-sidebar">
      {/* Logo */}
      <div className="bb-sidebar-logo">
        <div className="logo-icon">🩸</div>
        <div>
          <div className="logo-text">BloodBank</div>
          <div className="logo-sub">Management System</div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {links.map((item, idx) => {
          if (item.section) {
            return <div key={idx} className="bb-sidebar-section">{item.section}</div>;
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `bb-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.label === 'Blood Requests' && pendingCount > 0 && (
                <span className="bb-nav-badge">{pendingCount}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer: user info + logout */}
      <div className="bb-sidebar-footer">
        <div className="bb-sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user.full_name}</div>
            <div className="user-role">{user.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{ width: '100%', marginTop: 8 }}
          className="btn-logout"
        >
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
}
