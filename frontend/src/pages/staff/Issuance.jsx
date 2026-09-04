import { useEffect, useState } from 'react';
import api from '../../api/axios';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/ToastNotification';
import { extractError, formatDateTime, paginate, statusLabel, totalPages } from '../../utils/helpers';

const PAGE_SIZE = 10;

// Blood compatibility: which donor groups can give to which recipient
const COMPATIBLE_DONORS = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-'],
};

export default function Issuance() {
  const { show } = useToast();
  const [issuances, setIssuances]   = useState([]);
  const [requests, setRequests]     = useState([]);
  const [units, setUnits]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);

  const [form, setForm]             = useState({ blood_request: '', blood_unit: '', notes: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]   = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [compatibility, setCompatibility] = useState(null);
  const [confirm, setConfirm]       = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [issRes, reqRes, unitRes] = await Promise.all([
        api.get('/issuance/'),
        api.get('/requests/'),
        api.get('/blood-units/?status=available&page_size=500'),
      ]);
      setIssuances(issRes.data?.results ?? issRes.data);
      setRequests((reqRes.data?.results ?? reqRes.data).filter((r) => r.status === 'approved'));
      setUnits(unitRes.data?.results ?? unitRes.data);
    } catch (err) {
      show(extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  // Check compatibility when both fields are selected
  useEffect(() => {
    if (!form.blood_request || !form.blood_unit) { setCompatibility(null); return; }
    const req  = requests.find((r) => r.id === Number(form.blood_request));
    const unit = units.find((u) => u.id === Number(form.blood_unit));
    if (!req || !unit) { setCompatibility(null); return; }
    const compatible = COMPATIBLE_DONORS[req.blood_group]?.includes(unit.blood_group);
    setCompatibility({ req, unit, compatible });
  }, [form.blood_request, form.blood_unit, requests, units]);

  async function handleIssue() {
    setConfirm(false);
    setFormError(''); setFormSuccess('');
    setFormLoading(true);
    try {
      await api.post('/issuance/create/', {
        blood_request: Number(form.blood_request),
        blood_unit: Number(form.blood_unit),
        notes: form.notes,
      });
      setFormSuccess('✓ Blood issued successfully. Request marked as fulfilled.');
      setForm({ blood_request: '', blood_unit: '', notes: '' });
      setCompatibility(null);
      show('Blood issued and request fulfilled', 'success');
      fetchAll();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setFormLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.blood_request || !form.blood_unit) { setFormError('Both request and blood unit are required.'); return; }
    if (compatibility && !compatibility.compatible) {
      setFormError('Selected blood unit is not compatible with the request blood group.'); return;
    }
    setConfirm(true);
  }

  const total   = totalPages(issuances.length, PAGE_SIZE);
  const visible = paginate(issuances, page, PAGE_SIZE);

  // Pre-filter blood units to only those compatible with the selected request.
  // COMPATIBLE_DONORS[req.blood_group] lists which donor groups can supply that recipient.
  const selectedReq   = requests.find((r) => r.id === Number(form.blood_request));
  const filteredUnits = selectedReq
    ? units.filter((u) => COMPATIBLE_DONORS[selectedReq.blood_group]?.includes(u.blood_group))
    : [];

  return (
    <>
      <div className="bb-page-header">
        <h1>Blood Issuance</h1>
        <p>Issue blood units against approved blood requests</p>
      </div>

      <div className="row g-4">
        {/* Issue form */}
        <div className="col-12 col-lg-5">
          <div className="bb-card">
            <div className="bb-card-header"><h5>📦 Issue Blood</h5></div>
            <div className="bb-card-body">
              {formSuccess && <div className="bb-alert success mb-3">{formSuccess}</div>}
              {formError   && <div className="bb-alert danger mb-3">{formError}</div>}

              {requests.length === 0 && !loading && (
                <div className="bb-alert info mb-3">
                  <span>ℹ</span> No approved requests available. Approve a request first.
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="bb-form-label">Approved Blood Request</label>
                  <select className="bb-form-control" value={form.blood_request}
                    onChange={(e) => setForm({ ...form, blood_request: e.target.value, blood_unit: '' })}>
                    <option value="">Select request…</option>
                    {requests.map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.id} — {r.department_name} — {r.blood_group} × {r.units_requested}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="bb-form-label">
                    Available Blood Unit
                    {selectedReq && (
                      <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 6 }}>
                        ({filteredUnits.length} compatible unit{filteredUnits.length !== 1 ? 's' : ''})
                      </span>
                    )}
                  </label>
                  <select
                    className="bb-form-control"
                    value={form.blood_unit}
                    disabled={!selectedReq}
                    onChange={(e) => setForm({ ...form, blood_unit: e.target.value })}
                  >
                    <option value="">
                      {selectedReq
                        ? filteredUnits.length === 0
                          ? 'No compatible units available'
                          : 'Select unit…'
                        : 'Select a request first…'}
                    </option>
                    {filteredUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit #{u.id} — {u.blood_group} — Expires {u.expiry_date}
                      </option>
                    ))}
                  </select>
                  {selectedReq && filteredUnits.length === 0 && (
                    <small className="text-danger mt-1 d-block">
                      No available units are compatible with {selectedReq.blood_group}.
                      Compatible donor groups: {COMPATIBLE_DONORS[selectedReq.blood_group]?.join(', ')}.
                    </small>
                  )}
                </div>

                {/* Compatibility indicator */}
                {compatibility && (
                  <div className={`bb-alert ${compatibility.compatible ? 'success' : 'danger'} mb-3`}>
                    {compatibility.compatible ? (
                      <><span>✓</span> <strong>Compatible:</strong> {compatibility.unit.blood_group} unit can be given to {compatibility.req.blood_group} patient.</>
                    ) : (
                      <><span>⚠</span> <strong>Incompatible:</strong> {compatibility.unit.blood_group} blood cannot be given to a {compatibility.req.blood_group} patient.
                        <br /><small>Compatible donors for {compatibility.req.blood_group}: {COMPATIBLE_DONORS[compatibility.req.blood_group]?.join(', ')}</small>
                      </>
                    )}
                  </div>
                )}

                <div className="mb-3">
                  <label className="bb-form-label">Notes (optional)</label>
                  <textarea className="bb-form-control" rows={2} value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>

                <button
                  type="submit"
                  className="btn-bb-primary w-100 justify-content-center"
                  disabled={formLoading || (compatibility && !compatibility.compatible)}
                >
                  {formLoading
                    ? <><span className="spinner-border spinner-border-sm me-1" />Issuing…</>
                    : '📦 Issue Blood'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Issuance history */}
        <div className="col-12 col-lg-7">
          <div className="bb-card">
            <div className="bb-card-header"><h5>📋 Issuance Records ({issuances.length})</h5></div>
            {loading ? (
              <div className="bb-page-loader"><div className="bb-spinner" /></div>
            ) : visible.length === 0 ? (
              <EmptyState icon="📦" title="No issuances yet" message="Issue the first blood unit using the form." />
            ) : (
              <>
                <div className="bb-table-wrap">
                  <table className="bb-table">
                    <thead>
                      <tr><th>#</th><th>Unit</th><th>Blood Group</th><th>Request</th><th>Dept</th><th>Issued By</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {visible.map((i) => (
                        <tr key={i.id}>
                          <td style={{ color: '#94a3b8', fontSize: 12, width: 40, whiteSpace: 'nowrap' }}>{i.id}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>Unit #{i.blood_unit}</td>
                          <td><BloodGroupBadge group={i.blood_unit_group} /></td>
                          <td style={{ whiteSpace: 'nowrap' }}>Req #{i.blood_request}</td>
                          <td style={{ fontSize: 12 }}>{i.department_name}</td>
                          <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{i.issued_by_name}</td>
                          <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDateTime(i.issued_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {total > 1 && (
                  <div className="bb-pagination">
                    <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>‹</button>
                    {Array.from({ length: total }, (_, i) => (
                      <button key={i + 1} className={page === i + 1 ? 'active' : ''} onClick={() => setPage(i + 1)}>{i + 1}</button>
                    ))}
                    <button onClick={() => setPage((p) => p + 1)} disabled={page === total}>›</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {confirm && compatibility && (
        <ConfirmModal
          title="Confirm Blood Issuance"
          message={`Issue Unit #${form.blood_unit} (${compatibility.unit.blood_group}) against Request #${form.blood_request} for ${compatibility.req.department_name}? The request will be marked as fulfilled.`}
          confirmLabel="Issue Blood"
          danger={false}
          loading={formLoading}
          onConfirm={handleIssue}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  );
}
