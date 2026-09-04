import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import KPIStatCard from '../../components/KPIStatCard';
import { useToast } from '../../components/ToastNotification';
import { extractError, formatDateTime, statusLabel } from '../../utils/helpers';

export default function AdminDashboard() {
  const { show } = useToast();
  const [stats, setStats]   = useState(null);
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [staffForm, setStaffForm] = useState({ email: '', full_name: '', password: '', role: 'staff' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [forecast, setForecast]       = useState([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [dashRes, usersRes, forecastRes] = await Promise.all([
        api.get('/reports/admin-dashboard/'),
        api.get('/auth/users/?page_size=200'),
        api.get('/forecasting/forecast/'),
      ]);
      setStats(dashRes.data);
      const rawUsers = usersRes.data?.results ?? usersRes.data;
      const sortedUsers = [...rawUsers].sort((a, b) => new Date(b.date_joined) - new Date(a.date_joined));
      setUsers(sortedUsers);
      setForecast(Array.isArray(forecastRes.data) ? forecastRes.data : []);
    } catch (err) {
      show(extractError(err), 'error', 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  async function toggleUser(id) {
    setToggling(id);
    try {
      const res = await api.patch(`/auth/users/${id}/toggle-active/`);
      setUsers((prev) => prev.map((u) => (u.id === id ? res.data : u)));
      show(`User ${res.data.is_active ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (err) {
      show(extractError(err), 'error');
    } finally {
      setToggling(null);
    }
  }

  async function handleCreateStaff(e) {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!staffForm.email || !staffForm.full_name || !staffForm.password) {
      setFormError('All fields are required.'); return;
    }
    setFormLoading(true);
    try {
      await api.post('/auth/users/create-staff/', staffForm);
      setFormSuccess(`✓ ${staffForm.role === 'admin' ? 'Admin' : 'Staff'} account created for ${staffForm.email}`);
      setStaffForm({ email: '', full_name: '', password: '', role: 'staff' });
      fetchAll();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setFormLoading(false);
    }
  }

  const highRiskCount  = forecast.filter((f) => f.risk_level === 'HIGH').length;
  const highRiskGroups = forecast.filter((f) => f.risk_level === 'HIGH').map((f) => f.blood_group);

  const kpis = [
    { icon: '👥', label: 'Total Donors',          value: stats?.total_donors,    color: 'red'   },
    { icon: '💉', label: 'Total Donations',        value: stats?.total_donations, color: 'green' },
    { icon: '📋', label: 'Total Requests',         value: stats?.requests_by_status?.reduce((s, r) => s + r.count, 0), color: 'blue' },
    { icon: '📦', label: 'Issued This Month',      value: stats?.issuances_this_month, color: 'amber' },
    { icon: '🩸', label: 'High Risk Blood Groups', value: highRiskCount, color: highRiskCount > 0 ? 'red' : 'green' },
  ];

  return (
    <>
      <div className="bb-page-header">
        <h1>Admin Dashboard</h1>
        <p>Overview of hospital blood bank operations</p>
      </div>

      {/* KPIs */}
      <div className="row g-3 mb-4">
        {kpis.map((k) => (
          <div key={k.label} className="col-12 col-sm-6 col-xl-3">
            <KPIStatCard {...k} loading={loading} />
          </div>
        ))}
      </div>

      {/* Forecasting alert — only shown after data has loaded */}
      {!loading && forecast.length > 0 && (
        highRiskCount > 0 ? (
          <div className="bb-alert danger mb-4">
            <span>⚠</span>
            <div>
              <strong>Forecast Alert:</strong>{' '}
              {highRiskGroups.join(', ')}{' '}
              {highRiskCount === 1 ? 'is' : 'are'} HIGH RISK — projected demand exceeds current stock.
            </div>
          </div>
        ) : (
          <div className="bb-alert success mb-4">
            <span>✓</span> All blood groups have adequate stock.
          </div>
        )
      )}

      <div className="row g-4">
        {/* Requests by status */}
        <div className="col-12 col-lg-4">
          <div className="bb-card h-100">
            <div className="bb-card-header"><h5>📋 Requests by Status</h5></div>
            <div className="bb-card-body">
              {loading ? <div className="bb-page-loader"><div className="bb-spinner" /></div>
                : !stats?.requests_by_status?.length
                  ? <p className="text-muted text-center mt-3">No requests yet.</p>
                  : stats.requests_by_status.map((r) => (
                    <div key={r.status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                      <span className={`status-badge ${r.status}`}>{statusLabel(r.status)}</span>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{r.count}</span>
                    </div>
                  ))}
              {stats && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Expired units</span>
                  <span style={{ fontWeight: 700, color: '#dc3545' }}>{stats.expired_units}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create staff account */}
        <div className="col-12 col-lg-8">
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>➕ Create Staff Account</h5>
              <Link to="/admin/users" style={{ fontSize: 13, color: '#dc3545', textDecoration: 'none' }}>View All Users →</Link>
            </div>
            <div className="bb-card-body">
              {formSuccess && <div className="bb-alert success mb-3"><span>✓</span> {formSuccess}</div>}
              {formError   && <div className="bb-alert danger mb-3"><span>⚠</span> {formError}</div>}
              <form onSubmit={handleCreateStaff}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="bb-form-label">Full Name</label>
                    <input className="bb-form-control" placeholder="Dr. Ahmed Khan" value={staffForm.full_name}
                      onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="bb-form-label">Email</label>
                    <input type="email" className="bb-form-control" placeholder="staff@hospital.com" value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="bb-form-label">Password</label>
                    <input type="password" className="bb-form-control" placeholder="Min 8 characters" value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="bb-form-label">Role</label>
                    <select className="bb-form-control" value={staffForm.role}
                      onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <button type="submit" className="btn-bb-primary" disabled={formLoading}>
                      {formLoading ? <><span className="spinner-border spinner-border-sm me-1" />Creating…</> : '➕ Create Account'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Recent users */}
        <div className="col-12">
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>👥 Recent Users</h5>
              <Link to="/admin/users" style={{ fontSize: 13, color: '#dc3545', textDecoration: 'none' }}>View All →</Link>
            </div>
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.slice(0, 8).map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.full_name}</strong></td>
                      <td style={{ color: '#64748b' }}>{u.email}</td>
                      <td><span className={`status-badge ${u.role}`}>{u.role}</span></td>
                      <td style={{ color: '#64748b' }}>{formatDateTime(u.date_joined)}</td>
                      <td><span className={`status-badge ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          style={{ fontSize: 12 }}
                          disabled={toggling === u.id}
                          onClick={() => toggleUser(u.id)}
                        >
                          {toggling === u.id ? '…' : u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && !loading && <div className="bb-empty"><div className="bb-empty-icon">👥</div><h6>No users found</h6></div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
