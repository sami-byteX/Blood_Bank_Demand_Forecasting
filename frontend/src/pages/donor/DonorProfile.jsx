import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import { useToast } from '../../components/ToastNotification';
import { ALL_BLOOD_GROUPS, extractError, formatDate } from '../../utils/helpers';

// ── Validation ───────────────────────────────────────────────────────────────
const CNIC_RE    = /^\d{5}-\d{7}-\d{1}$/;
const CONTACT_RE = /^(?:\+92|0)3\d{9}$/;

function validateCNIC(v)    { return CNIC_RE.test(v)    ? '' : 'CNIC must be in format: 36302-1234567-1'; }
function validateContact(v) { return CONTACT_RE.test(v) ? '' : 'Contact must be a valid Pakistani number: 03001234567 or +923001234567'; }

// Auto-format raw digits → DDDDD-DDDDDDD-D as the user types
function formatCNIC(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5)  return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

// ── Constants ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  cnic: '', contact_number: '', address: '',
  age: '', gender: '', blood_group: '',
  has_hepatitis: false, has_hiv: false,
  has_heart_disease: false, recent_surgery: false,
};
const EMPTY_ERRORS = { cnic: '', contact_number: '' };

// ── Component ────────────────────────────────────────────────────────────────
export default function DonorProfile() {
  const { show } = useToast();
  const navigate = useNavigate();

  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [editing,      setEditing]      = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [fieldErrors,  setFieldErrors]  = useState(EMPTY_ERRORS);
  const [saveLoading,  setSaveLoading]  = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [saveSuccess,  setSaveSuccess]  = useState('');

  useEffect(() => { fetchProfile(); }, []);

  async function fetchProfile() {
    setLoading(true);
    try {
      const { data } = await api.get('/donors/me/');
      setProfile(data);
      setForm({
        cnic:              data.cnic,
        contact_number:    data.contact_number,
        address:           data.address            ?? '',
        age:               data.age,
        gender:            data.gender,
        blood_group:       data.blood_group,
        has_hepatitis:     data.has_hepatitis      ?? false,
        has_hiv:           data.has_hiv            ?? false,
        has_heart_disease: data.has_heart_disease  ?? false,
        recent_surgery:    data.recent_surgery     ?? false,
      });
      setFieldErrors(EMPTY_ERRORS);
    } catch (err) {
      if (err.response?.status === 404) {
        setProfile(null);
        setCreating(true);
        setForm(EMPTY_FORM);
        setFieldErrors(EMPTY_ERRORS);
      } else {
        show(extractError(err), 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Field change handlers ──────────────────────────────────────────────────
  function handleCNICChange(e) {
    const formatted = formatCNIC(e.target.value);
    setForm({ ...form, cnic: formatted });
    setFieldErrors({ ...fieldErrors, cnic: validateCNIC(formatted) });
  }

  function handleContactChange(e) {
    const val = e.target.value;
    setForm({ ...form, contact_number: val });
    setFieldErrors({ ...fieldErrors, contact_number: validateContact(val) });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault();
    setSaveError(''); setSaveSuccess('');

    // Run all validations before submitting
    const cnicErr    = validateCNIC(form.cnic);
    const contactErr = validateContact(form.contact_number);
    setFieldErrors({ cnic: cnicErr, contact_number: contactErr });

    if (!form.cnic || !form.contact_number || !form.age || !form.gender || !form.blood_group) {
      setSaveError('CNIC, contact number, age, gender, and blood group are required.');
      return;
    }
    if (cnicErr || contactErr) {
      setSaveError('Please fix the validation errors above before saving.');
      return;
    }

    setSaveLoading(true);
    try {
      if (creating) {
        await api.post('/donors/me/', form);
        setSaveSuccess('✓ Profile created successfully! Redirecting…');
      } else {
        await api.patch('/donors/me/', form);
        setSaveSuccess('✓ Profile updated successfully! Redirecting…');
      }
      show('Profile saved', 'success');
      await fetchProfile();
      setTimeout(() => navigate('/donor', { replace: true }), 1500);
    } catch (err) {
      setSaveError(extractError(err));
    } finally {
      setSaveLoading(false);
    }
  }

  function setCheck(field) {
    return (e) => setForm({ ...form, [field]: e.target.checked });
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError('');
    setFieldErrors(EMPTY_ERRORS);
    // Restore form to saved profile values
    if (profile) {
      setForm({
        cnic:              profile.cnic,
        contact_number:    profile.contact_number,
        address:           profile.address            ?? '',
        age:               profile.age,
        gender:            profile.gender,
        blood_group:       profile.blood_group,
        has_hepatitis:     profile.has_hepatitis      ?? false,
        has_hiv:           profile.has_hiv            ?? false,
        has_heart_disease: profile.has_heart_disease  ?? false,
        recent_surgery:    profile.recent_surgery     ?? false,
      });
    }
  }

  if (loading) return <div className="bb-page-loader"><div className="bb-spinner" /></div>;

  const isForm = editing || creating;

  return (
    <>
      <div className="bb-page-header">
        <h1>My Profile</h1>
        <p>View and update your donor information</p>
      </div>

      <div className="row g-4 justify-content-center">
        <div className="col-12 col-lg-8">
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>👤 Donor Information</h5>
              {!isForm && profile && (
                <button className="btn-bb-outline" onClick={() => setEditing(true)}>✏ Edit</button>
              )}
            </div>
            <div className="bb-card-body">
              {saveSuccess && <div className="bb-alert success mb-3">{saveSuccess}</div>}
              {saveError   && <div className="bb-alert danger mb-3">{saveError}</div>}

              {creating && !saveSuccess && (
                <div className="bb-alert info mb-4">
                  <span>ℹ</span> You don't have a profile yet. Fill in the details below to get started.
                </div>
              )}

              {/* ── Form (create or edit) ── */}
              {isForm ? (
                <form onSubmit={handleSave}>
                  <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em', marginBottom: 12 }}>
                    Personal Details
                  </p>
                  <div className="row g-3 mb-4">

                    {/* CNIC — with auto-format */}
                    <div className="col-md-6">
                      <label className="bb-form-label">CNIC *</label>
                      <input
                        className={`bb-form-control${fieldErrors.cnic ? ' error' : ''}`}
                        placeholder="36302-1234567-1"
                        value={form.cnic}
                        onChange={handleCNICChange}
                        maxLength={15}
                      />
                      {fieldErrors.cnic && (
                        <div className="form-error">{fieldErrors.cnic}</div>
                      )}
                    </div>

                    {/* Contact */}
                    <div className="col-md-6">
                      <label className="bb-form-label">Contact Number *</label>
                      <input
                        className={`bb-form-control${fieldErrors.contact_number ? ' error' : ''}`}
                        placeholder="03001234567"
                        value={form.contact_number}
                        onChange={handleContactChange}
                        maxLength={14}
                      />
                      {fieldErrors.contact_number && (
                        <div className="form-error">{fieldErrors.contact_number}</div>
                      )}
                    </div>

                    <div className="col-md-4">
                      <label className="bb-form-label">Age *</label>
                      <input type="number" className="bb-form-control" min={18} max={65}
                        value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="bb-form-label">Gender *</label>
                      <select className="bb-form-control" value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                        <option value="">Select…</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="bb-form-label">Blood Group *</label>
                      <select className="bb-form-control" value={form.blood_group}
                        onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                        <option value="">Select…</option>
                        {ALL_BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="bb-form-label">Address</label>
                      <textarea className="bb-form-control" rows={2} value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </div>
                  </div>

                  {/* Medical information */}
                  <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em', marginBottom: 12 }}>
                    Medical Information
                  </p>
                  <div className="bb-alert warning mb-3" style={{ fontSize: 13 }}>
                    <span>ℹ</span> Answering yes to any medical question may affect your donation eligibility.
                    Please answer honestly.
                  </div>
                  <div className="row g-3 mb-4">
                    {[
                      { field: 'has_hepatitis',    label: 'Do you have Hepatitis (A, B, or C)?' },
                      { field: 'has_hiv',           label: 'Do you have HIV/AIDS?' },
                      { field: 'has_heart_disease', label: 'Do you have a heart condition or disease?' },
                      { field: 'recent_surgery',    label: 'Have you had surgery in the last 6 months?' },
                    ].map(({ field, label }) => (
                      <div key={field} className="col-12">
                        <label style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '12px 14px',
                          background: form[field] ? '#fef2f2' : '#f8fafc',
                          border: `1px solid ${form[field] ? '#fecaca' : '#e2e8f0'}`,
                          borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                          transition: 'all 0.15s',
                        }}>
                          <input
                            type="checkbox"
                            style={{ width: 17, height: 17, accentColor: '#dc3545', cursor: 'pointer', flexShrink: 0 }}
                            checked={!!form[field]}
                            onChange={setCheck(field)}
                          />
                          <span style={{ fontSize: 14, color: form[field] ? '#b91c1c' : '#334155', fontWeight: form[field] ? 600 : 400 }}>
                            {label}
                          </span>
                          {form[field] && (
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#dc3545', fontWeight: 700 }}>
                              YES — affects eligibility
                            </span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className="btn-bb-primary" disabled={saveLoading}>
                      {saveLoading
                        ? <><span className="spinner-border spinner-border-sm me-1" />Saving…</>
                        : '💾 Save Profile'}
                    </button>
                    {!creating && (
                      <button type="button" className="btn-bb-outline" onClick={cancelEdit}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

              ) : (
                /* ── View mode ── */
                profile && (
                  <>
                    <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em', marginBottom: 12 }}>
                      Personal Details
                    </p>
                    <div className="row g-3 mb-4">
                      {[
                        { label: 'CNIC',          value: <code>{profile.cnic}</code> },
                        { label: 'Blood Group',   value: <BloodGroupBadge group={profile.blood_group} size="lg" /> },
                        { label: 'Age',           value: `${profile.age} years` },
                        { label: 'Gender',        value: profile.gender },
                        { label: 'Contact',       value: profile.contact_number },
                        { label: 'Address',       value: profile.address || '—' },
                        { label: 'Registered On', value: formatDate(profile.registration_date) },
                        { label: 'Last Donation', value: formatDate(profile.last_donation_date) },
                        { label: 'Eligibility',   value: (
                          <span className={`eligibility-badge ${profile.is_eligible ? 'eligible' : 'ineligible'}`}>
                            {profile.is_eligible ? '✓ Eligible' : '✕ Not Eligible'}
                          </span>
                        )},
                      ].map(({ label, value }) => (
                        <div key={label} className="col-12 col-sm-6">
                          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8 }}>
                            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{value}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em', marginBottom: 12 }}>
                      Medical Information
                    </p>
                    <div className="row g-2">
                      {[
                        { field: 'has_hepatitis',    label: 'Hepatitis' },
                        { field: 'has_hiv',           label: 'HIV/AIDS' },
                        { field: 'has_heart_disease', label: 'Heart Disease' },
                        { field: 'recent_surgery',    label: 'Recent Surgery' },
                      ].map(({ field, label }) => (
                        <div key={field} className="col-6 col-sm-3">
                          <div style={{
                            padding: '10px 12px', borderRadius: 8, textAlign: 'center',
                            background: profile[field] ? '#fef2f2' : '#f0fdf4',
                            border: `1px solid ${profile[field] ? '#fecaca' : '#bbf7d0'}`,
                          }}>
                            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: profile[field] ? '#dc3545' : '#198754' }}>
                              {profile[field] ? 'Yes' : 'No'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
