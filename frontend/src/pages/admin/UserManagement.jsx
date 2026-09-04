import { useEffect, useState } from 'react';
import api from '../../api/axios';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/ToastNotification';
import { extractError, formatDateTime, paginate, totalPages } from '../../utils/helpers';

const PAGE_SIZE = 10;

export default function UserManagement() {
  const { show } = useToast();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage]         = useState(1);
  const [confirm, setConfirm]   = useState(null);   // { user }
  const [toggling, setToggling] = useState(false);

  const [form, setForm]           = useState({ email: '', full_name: '', password: '', role: 'staff' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/users/');
      setUsers(data?.results ?? data);
    } catch (err) {
      show(extractError(err), 'error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function confirmToggle() {
    if (!confirm) return;
    setToggling(true);
    try {
      const res = await api.patch(`/auth/users/${confirm.user.id}/toggle-active/`);
      setUsers((prev) => prev.map((u) => (u.id === confirm.user.id ? res.data : u)));
      show(`User ${res.data.is_active ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (err) {
      show(extractError(err), 'error');
    } finally {
      setToggling(false);
      setConfirm(null);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!form.email || !form.full_name || !form.password) { setFormError('All fields are required.'); return; }
    setFormLoading(true);
    try {
      await api.post('/auth/users/create-staff/', form);
      setFormSuccess(`✓ Account created for ${form.email}`);
      setForm({ email: '', full_name: '', password: '', role: 'staff' });
      fetchUsers();
      show('Staff account created successfully', 'success');
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setFormLoading(false);
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });
  const total = totalPages(filtered.length, PAGE_SIZE);
  const visible = paginate(filtered, page, PAGE_SIZE);

  return (
    <>
      <div className="bb-page-header">
        <h1>User Management</h1>
        <p>Manage staff, admin, and donor accounts</p>
      </div>

      <div className="row g-4">
        {/* Create account form */}
        <div className="col-12 col-lg-4">
          <div className="bb-card">
            <div className="bb-card-header"><h5>➕ New Staff Account</h5></div>
            <div className="bb-card-body">
              {formSuccess && <div className="bb-alert success mb-3">{formSuccess}</div>}
              {formError   && <div className="bb-alert danger mb-3">{formError}</div>}
              <form onSubmit={handleCreate}>
                <div className="mb-3">
                  <label className="bb-form-label">Full Name</label>
                  <input className="bb-form-control" value={form.full_name} placeholder="Full name"
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="bb-form-label">Email</label>
                  <input type="email" className="bb-form-control" value={form.email} placeholder="email@hospital.com"
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="bb-form-label">Password</label>
                  <input type="password" className="bb-form-control" value={form.password} placeholder="Min 8 characters"
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="bb-form-label">Role</label>
                  <select className="bb-form-control" value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="btn-bb-primary w-100 justify-content-center" disabled={formLoading}>
                  {formLoading ? <><span className="spinner-border spinner-border-sm me-1" />Creating…</> : '➕ Create Account'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* User list */}
        <div className="col-12 col-lg-8">
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>👥 All Users ({filtered.length})</h5>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="bb-form-control"
                  style={{ width: 180, padding: '6px 10px', fontSize: 13 }}
                  placeholder="Search name or email…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                <select
                  className="bb-form-control"
                  style={{ width: 110, padding: '6px 8px', fontSize: 13 }}
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All roles</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="donor">Donor</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="bb-page-loader"><div className="bb-spinner" /></div>
            ) : visible.length === 0 ? (
              <EmptyState icon="👥" title="No users found" message="Try adjusting your search or filter." />
            ) : (
              <>
                <div className="bb-table-wrap">
                  <table className="bb-table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {visible.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.full_name}</strong></td>
                          <td style={{ color: '#64748b', fontSize: 13 }}>{u.email}</td>
                          <td><span className={`status-badge ${u.role}`}>{u.role}</span></td>
                          <td style={{ color: '#64748b', fontSize: 13 }}>{formatDateTime(u.date_joined)}</td>
                          <td><span className={`status-badge ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                          <td>
                            <button
                              className={`btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                              style={{ fontSize: 12 }}
                              onClick={() => setConfirm({ user: u })}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {total > 1 && (
                  <div className="bb-pagination">
                    <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>‹</button>
                    {Array.from({ length: total }, (_, i) => (
                      <button key={i + 1} className={page === i + 1 ? 'active' : ''} onClick={() => setPage(i + 1)}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setPage((p) => p + 1)} disabled={page === total}>›</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.user.is_active ? 'Deactivate User' : 'Activate User'}
          message={`Are you sure you want to ${confirm.user.is_active ? 'deactivate' : 'activate'} ${confirm.user.full_name}?`}
          confirmLabel={confirm.user.is_active ? 'Deactivate' : 'Activate'}
          danger={confirm.user.is_active}
          loading={toggling}
          onConfirm={confirmToggle}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
