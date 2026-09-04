import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import EmptyState from '../../components/EmptyState';
import KPIStatCard from '../../components/KPIStatCard';
import { useToast } from '../../components/ToastNotification';
import { eligibilityReason, extractError, formatDate, formatDateTime, nextEligibleDate } from '../../utils/helpers';

// Three distinct loading states so each section renders independently
const LOAD = { IDLE: 'idle', LOADING: 'loading', DONE: 'done', ERROR: 'error' };

export default function DonorDashboard() {
  const { show } = useToast();

  // profile — null means "not loaded yet", false means "confirmed no profile"
  const [profile,        setProfile]        = useState(null);
  const [profileStatus,  setProfileStatus]  = useState(LOAD.IDLE);
  const [donations,      setDonations]      = useState([]);
  const [donationsLoad,  setDonationsLoad]  = useState(LOAD.IDLE);

  useEffect(() => {
    fetchProfile();
    fetchMyDonations();
  }, []);

  // ── GET /api/donors/my-profile/ ──────────────────────────────────────────
  async function fetchProfile() {
    setProfileStatus(LOAD.LOADING);
    try {
      const { data } = await api.get('/donors/my-profile/');
      setProfile(data);
      setProfileStatus(LOAD.DONE);
    } catch (err) {
      if (err.response?.status === 404) {
        setProfile(false);          // confirmed: no profile exists
        setProfileStatus(LOAD.DONE);
      } else {
        setProfileStatus(LOAD.ERROR);
        show(extractError(err), 'error', 'Could not load profile');
      }
    }
  }

  // ── GET /api/donations/my-donations/ ────────────────────────────────────
  async function fetchMyDonations() {
    setDonationsLoad(LOAD.LOADING);
    try {
      const { data } = await api.get('/donations/my-donations/');
      setDonations(data?.results ?? (Array.isArray(data) ? data : []));
      setDonationsLoad(LOAD.DONE);
    } catch (err) {
      setDonationsLoad(LOAD.ERROR);
      show(extractError(err), 'error', 'Could not load donation history');
    }
  }

  // ── Derived values from profile ──────────────────────────────────────────
  const profileLoading   = profileStatus   === LOAD.LOADING || profileStatus === LOAD.IDLE;
  const donationsLoading = donationsLoad   === LOAD.LOADING || donationsLoad === LOAD.IDLE;
  const hasProfile       = profile && profile !== false;
  const nextEligible     = hasProfile && profile.last_donation_date
    ? nextEligibleDate(profile.last_donation_date)
    : null;

  // Eligibility reason — only computable from public fields (age + last_donation_date)
  function getIneligibleReason(p) {
    if (!p) return null;
    if (p.age < 18 || p.age > 65) return `Age ${p.age} is outside the allowed range (18–65).`;
    if (p.last_donation_date) {
      const days = Math.floor((new Date() - new Date(p.last_donation_date)) / 86400000);
      if (days < 56) return `Must wait ${56 - days} more day(s) after last donation.`;
    }
    return 'Medical conditions on file affect eligibility. Contact your blood bank.';
  }

  // ── KPI cards ────────────────────────────────────────────────────────────
  const kpis = [
    {
      icon: '💉',
      label: 'Total Donations',
      value: donationsLoading ? null : donations.length,
      color: 'red',
      loading: donationsLoading,
    },
    {
      icon: '🩸',
      label: 'Blood Group',
      value: hasProfile ? <BloodGroupBadge group={profile.blood_group} /> : '—',
      color: 'green',
      loading: profileLoading,
    },
    {
      icon: '📅',
      label: 'Last Donation',
      value: hasProfile ? formatDate(profile.last_donation_date) : '—',
      color: 'blue',
      loading: profileLoading,
    },
    {
      icon: '✅',
      label: 'Eligibility',
      value: profileLoading
        ? null
        : hasProfile
          ? (profile.is_eligible ? 'Eligible' : 'Ineligible')
          : '—',
      color: profileLoading || !hasProfile
        ? 'blue'
        : profile.is_eligible ? 'green' : 'amber',
      loading: profileLoading,
    },
  ];

  return (
    <>
      <div className="bb-page-header">
        <h1>My Dashboard</h1>
        <p>Your blood donation summary and eligibility status</p>
      </div>

      {/* ── Incomplete-profile warning ───────────────────────────────────── */}
      {!profileLoading && profile === false && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderLeft: '4px solid #f59e0b',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#92400e', fontSize: 15 }}>
                Your profile is incomplete
              </div>
              <div style={{ color: '#a16207', fontSize: 13, marginTop: 2 }}>
                Please complete your profile to check donation eligibility.
              </div>
            </div>
          </div>
          <Link
            to="/donor/profile"
            className="btn-bb-primary"
            style={{ textDecoration: 'none', background: '#d97706', whiteSpace: 'nowrap' }}
          >
            Complete Profile →
          </Link>
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="row g-3 mb-4">
        {kpis.map((k) => (
          <div key={k.label} className="col-12 col-sm-6 col-xl-3">
            <KPIStatCard {...k} />
          </div>
        ))}
      </div>

      <div className="row g-4">
        {/* ── Eligibility card ────────────────────────────────────────── */}
        <div className="col-12 col-md-5">
          <div className="bb-card">
            <div className="bb-card-header"><h5>🩸 Eligibility Status</h5></div>
            <div className="bb-card-body">
              {profileLoading ? (
                <div className="bb-page-loader"><div className="bb-spinner" /></div>
              ) : !hasProfile ? (
                <div className="bb-alert info">
                  <span>ℹ</span> Please complete your profile to see eligibility details.
                  <Link to="/donor/profile" style={{ marginLeft: 8, color: '#1d4ed8' }}>
                    Complete Profile →
                  </Link>
                </div>
              ) : (
                <>
                  {/* Eligibility badge — green or red, never defaults before load */}
                  <div style={{ textAlign: 'center', padding: '12px 0 16px' }}>
                    <span
                      className={`eligibility-badge ${profile.is_eligible ? 'eligible' : 'ineligible'}`}
                      style={{ fontSize: 16, padding: '10px 24px' }}
                    >
                      {profile.is_eligible ? '✓ You are Eligible to Donate' : '✗ You are Not Eligible'}
                    </span>
                  </div>

                  {/* Reason when ineligible */}
                  {!profile.is_eligible && (
                    <div className="bb-alert danger mb-3" style={{ fontSize: 13 }}>
                      <span>⚠</span> {getIneligibleReason(profile)}
                    </div>
                  )}

                  {/* Profile detail rows */}
                  <div>
                    {[
                      { label: 'Blood Group',        value: <BloodGroupBadge group={profile.blood_group} size="lg" /> },
                      { label: 'Last Donation',      value: formatDate(profile.last_donation_date) },
                      { label: 'Next Eligible Date', value: nextEligible ? formatDate(nextEligible) : 'You can donate now!' },
                      { label: 'CNIC',               value: <code>{profile.cnic}</code> },
                      { label: 'Contact',            value: profile.contact_number },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 0', borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Donation history ─────────────────────────────────────────── */}
        <div className="col-12 col-md-7">
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>💉 My Donation History</h5>
              {!donationsLoading && donations.length > 0 && (
                <span style={{ fontSize: 13, color: '#64748b' }}>{donations.length} record(s)</span>
              )}
            </div>

            {donationsLoading ? (
              <div className="bb-page-loader"><div className="bb-spinner" /></div>
            ) : donations.length === 0 ? (
              <EmptyState
                icon="💉"
                title="No donations yet"
                message="Your donation history will appear here after your first donation."
              />
            ) : (
              <div className="bb-table-wrap">
                <table className="bb-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Blood Group</th>
                      <th>Date</th>
                      <th>Recorded By</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((d) => (
                      <tr key={d.id}>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>{d.id}</td>
                        <td><BloodGroupBadge group={d.blood_group} /></td>
                        <td style={{ fontSize: 13, color: '#64748b' }}>{formatDateTime(d.donation_date)}</td>
                        <td style={{ fontSize: 13, color: '#64748b' }}>{d.recorded_by_name}</td>
                        <td style={{ fontSize: 13, color: '#94a3b8' }}>{d.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
