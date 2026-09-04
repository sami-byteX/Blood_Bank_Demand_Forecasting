import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import { useToast } from '../../components/ToastNotification';
import { ALL_BLOOD_GROUPS, eligibilityReason, extractError, formatDate, nextEligibleDate } from '../../utils/helpers';

// ── Constants ────────────────────────────────────────────────────────────────
const CNIC_RE    = /^\d{5}-\d{7}-\d{1}$/;
const CONTACT_RE = /^(?:\+92|0)3\d{9}$/;

const EMPTY_WALKIN = {
  full_name: '', email: '', password: '',
  cnic: '', phone: '', gender: '', blood_group: '', age: '', weight_kg: '',
};
const EMPTY_WI_ERRORS = {
  full_name: '', email: '', password: '',
  cnic: '', phone: '', gender: '', blood_group: '', age: '', weight_kg: '',
};

// ── CNIC helpers ─────────────────────────────────────────────────────────────
function formatCNIC(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5)  return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}
function looksLikeCNIC(val) { return /^\d/.test(val.trim()); }

// ── Field validators ──────────────────────────────────────────────────────────
function validateWalkIn(f) {
  const e = { ...EMPTY_WI_ERRORS };
  if (!f.full_name.trim())         e.full_name    = 'Full name is required.';
  if (!f.email.trim())             e.email        = 'Email is required.';
  if (f.password.length < 8)       e.password     = 'Password must be at least 8 characters.';
  if (!CNIC_RE.test(f.cnic))       e.cnic         = 'CNIC must be in format: 36302-1234567-1';
  if (!CONTACT_RE.test(f.phone))   e.phone        = 'Contact must be a valid Pakistani number: 03001234567 or +923001234567';
  if (!f.gender)                   e.gender       = 'Gender is required.';
  if (!f.blood_group)              e.blood_group  = 'Blood group is required.';

  const age = Number(f.age);
  if (!f.age || isNaN(age) || age < 18 || age > 65)
    e.age = 'Age must be between 18 and 65.';

  const wt = Number(f.weight_kg);
  if (!f.weight_kg || isNaN(wt) || wt < 50)
    e.weight_kg = 'Weight must be at least 50 kg.';

  return e;
}

function hasErrors(errs) {
  return Object.values(errs).some((v) => v !== '');
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DonorVerification() {
  const navigate   = useNavigate();
  const { show }   = useToast();

  // Search state
  const [query,      setQuery]      = useState('');
  const [queryError, setQueryError] = useState('');
  const [results,    setResults]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [selected,   setSelected]   = useState(null);

  // Walk-in modal state
  const [showModal,    setShowModal]    = useState(false);
  const [walkIn,       setWalkIn]       = useState(EMPTY_WALKIN);
  const [wiErrors,     setWiErrors]     = useState(EMPTY_WI_ERRORS);
  const [wiModalError, setWiModalError] = useState('');   // general form-level error
  const [wiSubmitting, setWiSubmitting] = useState(false);
  const [wiStep,       setWiStep]       = useState('');   // progress label

  // ── Search ─────────────────────────────────────────────────────────────────
  function handleQueryChange(e) {
    const raw = e.target.value;
    if (looksLikeCNIC(raw)) {
      const formatted = formatCNIC(raw);
      setQuery(formatted);
      setQueryError(
        formatted.length >= 5 && !CNIC_RE.test(formatted)
          ? 'CNIC must be in format: 36302-1234567-1'
          : ''
      );
    } else {
      setQuery(raw);
      setQueryError('');
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    if (looksLikeCNIC(query) && !CNIC_RE.test(query)) {
      setQueryError('CNIC must be in format: 36302-1234567-1');
      return;
    }
    setLoading(true); setError(''); setResults(null); setSelected(null);
    try {
      // Server-side search — DRF SearchFilter on cnic + user__full_name
      const { data } = await api.get(`/donors/?search=${encodeURIComponent(query.trim())}`);
      const found = data?.results ?? (Array.isArray(data) ? data : []);
      setResults(found);
      if (found.length === 0) {
        setError(`No donor found matching "${query}".`);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  function selectDonor(donor) {
    setSelected(donor);
    setResults(null);
  }

  function proceedToDonate() {
    if (!selected) return;
    navigate('/staff/donations', {
      state: { donorId: selected.id, donorName: selected.user_full_name },
    });
  }

  // ── Walk-in form field change ───────────────────────────────────────────────
  function handleWiChange(field) {
    return (e) => {
      let val = e.target.value;
      if (field === 'cnic') val = formatCNIC(val);
      setWalkIn((prev) => ({ ...prev, [field]: val }));
      // Clear that field's error as soon as user starts correcting it
      setWiErrors((prev) => ({ ...prev, [field]: '' }));
    };
  }

  // ── Walk-in submit — single atomic POST /api/donors/create/ ──────────────
  async function handleWiSubmit(e) {
    e.preventDefault();
    setWiModalError('');

    const errs = validateWalkIn(walkIn);
    setWiErrors(errs);
    if (hasErrors(errs)) {
      // Clinical warnings as toasts for hard guardrails
      const age = Number(walkIn.age);
      const wt  = Number(walkIn.weight_kg);
      if (age < 18 || age > 65)
        show(`Clinical warning: Age ${walkIn.age} is outside the safe donation range (18–65).`, 'warning', 'Clinical Alert');
      if (wt < 50)
        show(`Clinical warning: Weight ${walkIn.weight_kg} kg is below the minimum threshold (50 kg).`, 'warning', 'Clinical Alert');
      return;
    }

    setWiSubmitting(true);
    setWiStep('Registering donor…');

    try {
      // Single call using the staff's authenticated token — no token switching needed.
      const { data: newProfile } = await api.post('/donors/create/', {
        full_name:      walkIn.full_name,
        email:          walkIn.email,
        password:       walkIn.password,
        cnic:           walkIn.cnic,
        contact_number: walkIn.phone,
        gender:         walkIn.gender,
        blood_group:    walkIn.blood_group,
        age:            Number(walkIn.age),
        weight_kg:      Number(walkIn.weight_kg),
        address:        '',
      });

      // Success — close modal and auto-select the new donor
      setShowModal(false);
      setWalkIn(EMPTY_WALKIN);
      setWiErrors(EMPTY_WI_ERRORS);
      setWiModalError('');
      setWiStep('');
      setQuery(newProfile.user_full_name);
      setSelected(newProfile);
      setResults(null);
      show(
        `${newProfile.user_full_name} registered and verified successfully.`,
        'success',
        'Walk-In Registered',
      );
    } catch (err) {
      // Keep modal open — surface the API error inside the form
      const msg = extractError(err);
      setWiModalError(msg);
      show(msg, 'error', 'Registration failed');
    } finally {
      setWiSubmitting(false);
      setWiStep('');
    }
  }

  function closeModal() {
    if (wiSubmitting) return;
    setShowModal(false);
    setWalkIn(EMPTY_WALKIN);
    setWiErrors(EMPTY_WI_ERRORS);
    setWiModalError('');
    setWiStep('');
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const reason       = selected ? eligibilityReason(selected) : null;
  const noResults    = results !== null && results.length === 0;
  const hasResults   = results !== null && results.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe animations — injected at component scope */}
      <style>{`
        @keyframes walkin-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(220,53,69,0.55); transform: scale(1); }
          60%  { box-shadow: 0 0 0 14px rgba(220,53,69,0); transform: scale(1.03); }
          100% { box-shadow: 0 0 0 0 rgba(220,53,69,0);    transform: scale(1); }
        }
        .btn-walkin-cta {
          animation: walkin-pulse 1.8s ease-in-out infinite;
          background: #dc3545; color: #fff;
          border: none; border-radius: 10px;
          padding: 14px 28px; font-size: 15px; font-weight: 700;
          cursor: pointer; display: inline-flex; align-items: center; gap: 10px;
          transition: background 0.15s;
        }
        .btn-walkin-cta:hover { background: #b02a37; animation-play-state: paused; }
        .wi-field-error { font-size: 12px; color: #dc3545; margin-top: 3px; }
      `}</style>

      <div className="bb-page-header">
        <h1>Donor Verification</h1>
        <p>Search donor by CNIC or name to verify eligibility before recording a donation</p>
      </div>

      {/* ── Search card ─────────────────────────────────────────────────── */}
      <div className="bb-card mb-4">
        <div className="bb-card-body">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="bb-form-label">Search by CNIC or Name</label>
              <input
                className={`bb-form-control${queryError ? ' error' : ''}`}
                placeholder="e.g. 36302-1234567-1 or Ahmed Khan"
                value={query}
                onChange={handleQueryChange}
                autoFocus
              />
              {queryError && <div className="form-error mt-1">{queryError}</div>}
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn-bb-primary" disabled={loading}>
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-1" />Searching…</>
                  : '🔍 Search'}
              </button>
            </div>
          </form>

          {error && <div className="bb-alert warning mt-3">{error}</div>}

          {/* Search results list */}
          {hasResults && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                {results.length} result(s) found — click a donor to verify:
              </p>
              <div className="bb-table-wrap">
                <table className="bb-table">
                  <thead>
                    <tr><th>Name</th><th>CNIC</th><th>Blood Group</th><th>Last Donation</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {results.map((d) => (
                      <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => selectDonor(d)}>
                        <td><strong>{d.user_full_name}</strong></td>
                        <td style={{ fontFamily: 'monospace' }}>{d.cnic}</td>
                        <td><BloodGroupBadge group={d.blood_group} /></td>
                        <td>{formatDate(d.last_donation_date)}</td>
                        <td><button className="btn btn-sm btn-outline-primary">Select</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Walk-in CTA — only when search returned zero matches ──── */}
          {noResults && (
            <div style={{
              marginTop: 24,
              padding: '24px 20px',
              background: '#fff5f5',
              border: '2px dashed #fca5a5',
              borderRadius: 12,
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 14, color: '#7f1d1d', fontWeight: 600, marginBottom: 6 }}>
                Donor not found in the system
              </p>
              <p style={{ fontSize: 13, color: '#b91c1c', marginBottom: 20 }}>
                Is this a new walk-in donor? Register them on the spot.
              </p>
              <button className="btn-walkin-cta" onClick={() => setShowModal(true)}>
                ➕ Register New Walk-In Donor
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Selected donor verification card ────────────────────────────── */}
      {selected && (
        <div className={`donor-info-card mb-4 ${selected.is_eligible ? 'eligible' : 'ineligible'}`}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16,
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                {selected.user_full_name}
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                CNIC: <code>{selected.cnic}</code>
              </p>
            </div>
            <span className={`eligibility-badge ${selected.is_eligible ? 'eligible' : 'ineligible'}`}>
              {selected.is_eligible ? '✓ Eligible to Donate' : '✕ Not Eligible'}
            </span>
          </div>

          <div className="row g-3 mb-4">
            {[
              { label: 'Blood Group',   value: <BloodGroupBadge group={selected.blood_group} size="lg" /> },
              { label: 'Age',           value: `${selected.age} years` },
              { label: 'Gender',        value: selected.gender },
              { label: 'Contact',       value: selected.contact_number },
              { label: 'Last Donation', value: formatDate(selected.last_donation_date) },
              { label: 'Next Eligible', value: selected.last_donation_date
                  ? formatDate(nextEligibleDate(selected.last_donation_date))
                  : 'Can donate now' },
            ].map(({ label, value }) => (
              <div key={label} className="col-6 col-md-4 col-lg-2">
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {!selected.is_eligible && reason && (
            <div className="bb-alert danger mb-3">
              <span>⚠</span> <strong>Reason:</strong> {reason}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn-bb-primary"
              disabled={!selected.is_eligible}
              onClick={proceedToDonate}
            >
              💉 Proceed to Record Donation
            </button>
            <button className="btn-bb-outline" onClick={() => setSelected(null)}>
              ← Search Again
            </button>
          </div>

          {!selected.is_eligible && (
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, marginBottom: 0 }}>
              Donation recording is disabled for ineligible donors.
            </p>
          )}
        </div>
      )}

      {/* ── Idle empty state ─────────────────────────────────────────────── */}
      {!selected && results === null && !loading && (
        <div className="bb-empty" style={{ marginTop: 32 }}>
          <div className="bb-empty-icon">🔍</div>
          <h6>Search for a donor</h6>
          <p>Enter a CNIC number or donor name above to begin verification.</p>
        </div>
      )}

      {/* ── Walk-in registration modal ───────────────────────────────────── */}
      {showModal && (
        <div className="bb-modal-backdrop" onClick={closeModal}>
          <div
            className="bb-modal"
            style={{ maxWidth: 600, width: '95%', maxHeight: '92vh', overflowY: 'auto', padding: '24px 28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 18 }}>➕ Register Walk-In Donor</h4>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Fill in all required fields. Age and weight are clinically validated.
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={wiSubmitting}
                style={{
                  background: 'none', border: 'none', fontSize: 22,
                  cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: 4,
                }}
              >×</button>
            </div>

            {/* General API error */}
            {wiModalError && (
              <div className="bb-alert danger mb-3" style={{ fontSize: 13 }}>
                <span>⚠</span> {wiModalError}
              </div>
            )}

            {/* Step progress */}
            {wiStep && (
              <div className="bb-alert info mb-3" style={{ fontSize: 13 }}>
                <span className="spinner-border spinner-border-sm me-2" />
                {wiStep}
              </div>
            )}

            <form onSubmit={handleWiSubmit} noValidate>
              {/* Section: Account */}
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                Account Details
              </p>
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="bb-form-label">Full Name *</label>
                  <input className={`bb-form-control${wiErrors.full_name ? ' error' : ''}`}
                    placeholder="Ahmed Khan" value={walkIn.full_name}
                    onChange={handleWiChange('full_name')} />
                  {wiErrors.full_name && <div className="wi-field-error">{wiErrors.full_name}</div>}
                </div>
                <div className="col-md-6">
                  <label className="bb-form-label">Email *</label>
                  <input type="email" className={`bb-form-control${wiErrors.email ? ' error' : ''}`}
                    placeholder="ahmed@example.com" value={walkIn.email}
                    onChange={handleWiChange('email')} />
                  {wiErrors.email && <div className="wi-field-error">{wiErrors.email}</div>}
                </div>
                <div className="col-12">
                  <label className="bb-form-label">Password *</label>
                  <input type="password" className={`bb-form-control${wiErrors.password ? ' error' : ''}`}
                    placeholder="Min 8 characters" value={walkIn.password}
                    onChange={handleWiChange('password')} />
                  {wiErrors.password && <div className="wi-field-error">{wiErrors.password}</div>}
                </div>
              </div>

              {/* Section: Identity */}
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                Identity
              </p>
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="bb-form-label">CNIC *</label>
                  <input className={`bb-form-control${wiErrors.cnic ? ' error' : ''}`}
                    placeholder="36302-1234567-1" value={walkIn.cnic}
                    onChange={handleWiChange('cnic')} maxLength={15} />
                  {wiErrors.cnic && <div className="wi-field-error">{wiErrors.cnic}</div>}
                </div>
                <div className="col-md-6">
                  <label className="bb-form-label">Phone *</label>
                  <input className={`bb-form-control${wiErrors.phone ? ' error' : ''}`}
                    placeholder="03001234567" value={walkIn.phone}
                    onChange={handleWiChange('phone')} maxLength={14} />
                  {wiErrors.phone && <div className="wi-field-error">{wiErrors.phone}</div>}
                </div>
              </div>

              {/* Section: Clinical */}
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                Clinical Details
              </p>
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <label className="bb-form-label">Gender *</label>
                  <select className={`bb-form-control${wiErrors.gender ? ' error' : ''}`}
                    value={walkIn.gender} onChange={handleWiChange('gender')}>
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {wiErrors.gender && <div className="wi-field-error">{wiErrors.gender}</div>}
                </div>
                <div className="col-md-4">
                  <label className="bb-form-label">Blood Group *</label>
                  <select className={`bb-form-control${wiErrors.blood_group ? ' error' : ''}`}
                    value={walkIn.blood_group} onChange={handleWiChange('blood_group')}>
                    <option value="">Select…</option>
                    {ALL_BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                  {wiErrors.blood_group && <div className="wi-field-error">{wiErrors.blood_group}</div>}
                </div>
                <div className="col-md-2">
                  <label className="bb-form-label">Age *</label>
                  <input type="number" min={18} max={65}
                    className={`bb-form-control${wiErrors.age ? ' error' : ''}`}
                    placeholder="e.g. 28" value={walkIn.age}
                    onChange={handleWiChange('age')} />
                  {wiErrors.age && <div className="wi-field-error">{wiErrors.age}</div>}
                </div>
                <div className="col-md-2">
                  <label className="bb-form-label">Weight (kg) * <span style={{ fontSize: 10, color: '#94a3b8' }}>min 50</span></label>
                  <input type="number" min={50}
                    className={`bb-form-control${wiErrors.weight_kg ? ' error' : ''}`}
                    placeholder="≥ 50" value={walkIn.weight_kg}
                    onChange={handleWiChange('weight_kg')} />
                  {wiErrors.weight_kg && <div className="wi-field-error">{wiErrors.weight_kg}</div>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-bb-outline" onClick={closeModal} disabled={wiSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-bb-primary" disabled={wiSubmitting}>
                  {wiSubmitting
                    ? <><span className="spinner-border spinner-border-sm me-1" />{wiStep || 'Registering…'}</>
                    : '✅ Register Donor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
