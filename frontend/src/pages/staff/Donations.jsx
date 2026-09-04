import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../api/axios';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/ToastNotification';
import { ALL_BLOOD_GROUPS, extractError, formatDateTime } from '../../utils/helpers';

function pageButtons(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

const PAGE_SIZE = 20;

export default function Donations() {
  const location = useLocation();
  const { show } = useToast();

  const donorId   = location.state?.donorId   ?? null;
  const donorName = location.state?.donorName ?? null;

  const [donations, setDonations]   = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [donors, setDonors]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [bgFilter, setBgFilter]     = useState('');

  const [form, setForm] = useState({
    donor:       donorId ? String(donorId) : '',
    blood_group: '',
    notes:       '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => { fetchDonors(); }, []);
  useEffect(() => { fetchDonations(); }, [page, bgFilter]);

  // When arriving from verification, auto-fill blood group once donors list loads.
  useEffect(() => {
    if (!donorId || donors.length === 0) return;
    const matched = donors.find((d) => d.id === donorId);
    if (matched) setForm((prev) => ({ ...prev, blood_group: matched.blood_group }));
  }, [donors, donorId]);

  async function fetchDonors() {
    try {
      const res = await api.get('/donors/?page_size=200');
      setDonors(res.data?.results ?? res.data);
    } catch (err) {
      show(extractError(err), 'error');
    }
  }

  async function fetchDonations() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: PAGE_SIZE });
      if (bgFilter) params.set('blood_group', bgFilter);
      const res  = await api.get(`/donations/?${params}`);
      const data = res.data;
      if (data?.results !== undefined) {
        setDonations(data.results);
        setTotalCount(data.count);
      } else {
        setDonations(data);
        setTotalCount(data.length);
      }
    } catch (err) {
      show(extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRecord(e) {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!form.donor || !form.blood_group) { setFormError('Donor and blood group are required.'); return; }
    setFormLoading(true);
    try {
      await api.post('/donations/', { donor: Number(form.donor), blood_group: form.blood_group, notes: form.notes });
      setFormSuccess('✓ Donation recorded successfully. Blood unit created automatically.');
      setForm({ donor: '', blood_group: '', notes: '' });
      show('Donation recorded and blood unit created', 'success');
      setPage(1);
      fetchDonations();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setFormLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <div className="bb-page-header">
        <h1>Donations</h1>
        <p>Record new donations and view donation history</p>
      </div>

      {donorId && donorName && (
        <div className="bb-alert success mb-4">
          <span>✓</span> Recording donation for: <strong>{donorName}</strong>
        </div>
      )}

      <div className="row g-4">
        {/* Form */}
        <div className="col-12 col-lg-4">
          <div className="bb-card">
            <div className="bb-card-header"><h5>💉 Record Donation</h5></div>
            <div className="bb-card-body">
              {formSuccess && <div className="bb-alert success mb-3">{formSuccess}</div>}
              {formError   && <div className="bb-alert danger mb-3">{formError}</div>}
              <form onSubmit={handleRecord}>
                <div className="mb-3">
                  <label className="bb-form-label">Donor</label>
                  {donorId ? (
                    <>
                      <input
                        className="bb-form-control"
                        value={donorName ?? ''}
                        disabled
                        style={{ background: '#f1f5f9', color: '#475569', cursor: 'not-allowed' }}
                      />
                      <input type="hidden" value={form.donor} />
                    </>
                  ) : (
                    <select className="bb-form-control" value={form.donor}
                      onChange={(e) => {
                        const d = donors.find((x) => x.id === Number(e.target.value));
                        setForm({ ...form, donor: e.target.value, blood_group: d?.blood_group ?? '' });
                      }}>
                      <option value="">Select donor…</option>
                      {donors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.user_full_name} — {d.blood_group} — CNIC: {d.cnic}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="mb-3">
                  <label className="bb-form-label">Blood Group</label>
                  <select className="bb-form-control" value={form.blood_group}
                    onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                    <option value="">Select…</option>
                    {ALL_BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="bb-form-label">Notes (optional)</label>
                  <textarea className="bb-form-control" rows={3} placeholder="Any observations…"
                    value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <button type="submit" className="btn-bb-primary w-100 justify-content-center" disabled={formLoading}>
                  {formLoading ? <><span className="spinner-border spinner-border-sm me-1" />Recording…</> : '💉 Record Donation'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* History table */}
        <div className="col-12 col-lg-8">
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>📋 Donation History ({totalCount})</h5>
              <select className="bb-form-control" style={{ width: 100, padding: '5px 8px', fontSize: 13 }}
                value={bgFilter} onChange={(e) => { setBgFilter(e.target.value); setPage(1); }}>
                <option value="">All groups</option>
                {ALL_BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="bb-page-loader"><div className="bb-spinner" /></div>
            ) : donations.length === 0 ? (
              <EmptyState icon="💉" title="No donations yet" message="Record the first donation using the form." />
            ) : (
              <>
                <div className="bb-table-wrap">
                  <table className="bb-table">
                    <thead><tr><th>#</th><th>Donor</th><th>Blood Group</th><th>Date</th><th>Recorded By</th><th>Notes</th></tr></thead>
                    <tbody>
                      {donations.map((d) => (
                        <tr key={d.id}>
                          <td style={{ color: '#94a3b8', fontSize: 12, width: 40, whiteSpace: 'nowrap' }}>{d.id}</td>
                          <td><strong>{d.donor_name}</strong></td>
                          <td><BloodGroupBadge group={d.blood_group} /></td>
                          <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDateTime(d.donation_date)}</td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{d.recorded_by_name}</td>
                          <td style={{ fontSize: 12, color: '#94a3b8' }}>{d.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="bb-pagination">
                    <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>‹</button>
                    {pageButtons(page, totalPages).map((p, i) =>
                      p === '…'
                        ? <span key={`e${i}`} style={{ padding: '0 6px', color: '#94a3b8', alignSelf: 'center' }}>…</span>
                        : <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
                    )}
                    <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>›</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
