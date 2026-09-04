import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/ToastNotification';
import { ALL_BLOOD_GROUPS, extractError, formatDate, statusLabel } from '../../utils/helpers';

const PAGE_SIZE = 10;

function pageButtons(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

export default function BloodRequests() {
  const { show } = useToast();
  const [requests, setRequests]     = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [departments, setDepts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [confirm, setConfirm]       = useState(null);
  const [actioning, setActioning]   = useState(false);

  const [form, setForm] = useState({ department: '', blood_group: '', units_requested: '', notes: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => { fetchDepts(); }, []);
  useEffect(() => { fetchRequests(); }, [page, statusFilter]);

  async function fetchDepts() {
    try {
      const res = await api.get('/departments/');
      setDepts(res.data?.results ?? res.data);
    } catch (err) {
      show(extractError(err), 'error');
    }
  }

  async function fetchRequests() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: PAGE_SIZE });
      if (statusFilter) params.set('status', statusFilter);
      const res  = await api.get(`/requests/?${params}`);
      const data = res.data;
      if (data?.results !== undefined) {
        setRequests(data.results);
        setTotalCount(data.count);
      } else {
        setRequests(data);
        setTotalCount(data.length);
      }
    } catch (err) {
      show(extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!form.department || !form.blood_group || !form.units_requested) {
      setFormError('Department, blood group, and units are required.'); return;
    }
    setFormLoading(true);
    try {
      await api.post('/requests/', {
        department: Number(form.department),
        blood_group: form.blood_group,
        units_requested: Number(form.units_requested),
        notes: form.notes,
      });
      setFormSuccess('✓ Blood request submitted successfully.');
      setForm({ department: '', blood_group: '', units_requested: '', notes: '' });
      show('Blood request submitted', 'success');
      setPage(1);
      fetchRequests();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleAction() {
    if (!confirm) return;
    setActioning(true);
    try {
      await api.patch(`/requests/${confirm.req.id}/status/`, { status: confirm.action });
      show(`Request ${statusLabel(confirm.action).toLowerCase()}`, 'success');
      fetchRequests();
    } catch (err) {
      show(extractError(err), 'error');
    } finally {
      setActioning(false);
      setConfirm(null);
    }
  }

  const totalPagesCount = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <div className="bb-page-header">
        <h1>Blood Requests</h1>
        <p>Submit and manage blood requests from hospital departments</p>
      </div>

      <div className="row g-4">
        {/* Create form */}
        <div className="col-12 col-lg-4">
          <div className="bb-card">
            <div className="bb-card-header"><h5>➕ New Blood Request</h5></div>
            <div className="bb-card-body">
              {formSuccess && <div className="bb-alert success mb-3">{formSuccess}</div>}
              {formError   && <div className="bb-alert danger mb-3">{formError}</div>}
              <form onSubmit={handleCreate}>
                <div className="mb-3">
                  <label className="bb-form-label">Department</label>
                  <select className="bb-form-control" value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}>
                    <option value="">Select department…</option>
                    {departments.filter((d) => d.is_active).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="bb-form-label">Blood Group</label>
                  <select className="bb-form-control" value={form.blood_group}
                    onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                    <option value="">Select blood group…</option>
                    {ALL_BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="bb-form-label">Units Requested</label>
                  <input type="number" className="bb-form-control" min={1} placeholder="e.g. 2"
                    value={form.units_requested}
                    onChange={(e) => setForm({ ...form, units_requested: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="bb-form-label">Notes (optional)</label>
                  <textarea className="bb-form-control" rows={2} value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <button type="submit" className="btn-bb-primary w-100 justify-content-center" disabled={formLoading}>
                  {formLoading ? <><span className="spinner-border spinner-border-sm me-1" />Submitting…</> : '➕ Submit Request'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Request list */}
        <div className="col-12 col-lg-8">
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>📋 All Requests ({totalCount})</h5>
              <select className="bb-form-control" style={{ width: 130, padding: '5px 8px', fontSize: 13 }}
                value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                {['pending', 'approved', 'rejected', 'fulfilled'].map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="bb-page-loader"><div className="bb-spinner" /></div>
            ) : requests.length === 0 ? (
              <EmptyState icon="📋" title="No requests found" message="Submit the first blood request using the form." />
            ) : (
              <>
                <div className="bb-table-wrap">
                  <table className="bb-table">
                    <thead>
                      <tr><th>Dept</th><th>Blood Group</th><th>Units</th><th>Date</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <tr key={r.id}>
                          <td>{r.department_name}</td>
                          <td><BloodGroupBadge group={r.blood_group} /></td>
                          <td><strong>{r.units_requested}</strong></td>
                          <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(r.request_date)}</td>
                          <td><span className={`status-badge ${r.status}`}>{statusLabel(r.status)}</span></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {r.status === 'pending' && (
                                <>
                                  <button
                                    className="btn btn-sm btn-outline-success"
                                    title="Approve"
                                    style={{ padding: '2px 8px', fontWeight: 700 }}
                                    onClick={() => setConfirm({ req: r, action: 'approved' })}>✓</button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    title="Reject"
                                    style={{ padding: '2px 8px', fontWeight: 700 }}
                                    onClick={() => setConfirm({ req: r, action: 'rejected' })}>✗</button>
                                </>
                              )}
                              {r.status === 'approved' && (
                                <Link className="btn btn-sm btn-outline-primary" style={{ whiteSpace: 'nowrap' }} to="/staff/issuance">Issue →</Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPagesCount > 1 && (
                  <div className="bb-pagination">
                    <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>‹</button>
                    {pageButtons(page, totalPagesCount).map((b, i) =>
                      b === '…'
                        ? <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: '#94a3b8' }}>…</span>
                        : <button key={b} className={page === b ? 'active' : ''} onClick={() => setPage(b)}>{b}</button>
                    )}
                    <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPagesCount}>›</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={`${statusLabel(confirm.action)} Request #${confirm.req.id}`}
          message={`Are you sure you want to mark this blood request as ${confirm.action}? Department: ${confirm.req.department_name}, Blood Group: ${confirm.req.blood_group}.`}
          confirmLabel={statusLabel(confirm.action)}
          danger={confirm.action === 'rejected'}
          loading={actioning}
          onConfirm={handleAction}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
