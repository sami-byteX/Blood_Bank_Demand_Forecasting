import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import KPIStatCard from '../../components/KPIStatCard';
import StockAlertCard from '../../components/StockAlertCard';
import { useToast } from '../../components/ToastNotification';
import { ALL_BLOOD_GROUPS, extractError, formatDateTime, statusLabel } from '../../utils/helpers';

export default function StaffDashboard() {
  const { show } = useToast();
  const [stats, setStats]         = useState(null);
  const [inventory, setInventory] = useState([]);
  const [donations, setDonations] = useState([]);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [sRes, invRes, donRes, reqRes] = await Promise.all([
        api.get('/reports/staff-dashboard/'),
        api.get('/inventory/'),
        api.get('/donations/?page_size=100'),
        api.get('/requests/'),
      ]);
      setStats(sRes.data);
      setInventory(invRes.data);
      const allDonations = donRes.data?.results ?? donRes.data
      const seen = new Set()
      const uniqueDonations = []
      for (const d of allDonations) {
        if (!seen.has(d.donor)) {
          seen.add(d.donor)
          uniqueDonations.push(d)
        }
        if (uniqueDonations.length >= 8) break
      }
      setDonations(uniqueDonations)
      setRequests(reqRes.data?.results ?? reqRes.data);
    } catch (err) {
      show(extractError(err), 'error', 'Dashboard failed to load');
    } finally {
      setLoading(false);
    }
  }

  const pendingReqs = requests.filter((r) => r.status === 'pending');
  const totalAvailable = inventory.reduce((sum, i) => sum + (i.available || 0), 0);

  const kpis = [
    { icon: '💉', label: "Today's Donations",  value: stats?.todays_donations,   color: 'red'   },
    { icon: '📋', label: 'Pending Requests',   value: stats?.pending_requests,   color: 'amber' },
    { icon: '🩸', label: 'Available Units',    value: totalAvailable,            color: 'green' },
    { icon: '⚠',  label: 'Expiry Alerts',      value: stats?.expiry_alerts_count, color: 'blue'  },
  ];

  return (
    <>
      <div className="bb-page-header">
        <h1>Staff Dashboard</h1>
        <p>Daily blood bank operations overview</p>
      </div>

      {/* KPIs */}
      <div className="row g-3 mb-4">
        {kpis.map((k) => (
          <div key={k.label} className="col-12 col-sm-6 col-xl-3">
            <KPIStatCard {...k} loading={loading} />
          </div>
        ))}
      </div>

      {/* Low stock alerts */}
      {!loading && stats?.low_stock?.length > 0 && (
        <div className="bb-alert warning mb-4">
          <span>⚠</span>
          <div>
            <strong>Low Stock Alert:</strong> {stats.low_stock.map((s) => `${s.blood_group} (${s.available} units)`).join(' · ')}
          </div>
        </div>
      )}

      {/* Inventory grid */}
      <div className="bb-card mb-4">
        <div className="bb-card-header">
          <h5>🩸 Blood Inventory</h5>
          <Link to="/staff/inventory" style={{ fontSize: 13, color: '#dc3545', textDecoration: 'none' }}>View Details →</Link>
        </div>
        <div className="bb-card-body">
          {loading ? (
            <div className="bb-page-loader"><div className="bb-spinner" /></div>
          ) : (
            <div className="row g-3">
              {ALL_BLOOD_GROUPS.map((bg) => {
                const inv = inventory.find((i) => i.blood_group === bg);
                return (
                  <div key={bg} className="col-6 col-sm-4 col-md-3">
                    <StockAlertCard bloodGroup={bg} available={inv?.available ?? 0} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="row g-4">
        {/* Pending requests */}
        <div className="col-12 col-lg-5">
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>📋 Pending Requests
                {pendingReqs.length > 0 && (
                  <span className="bb-nav-badge ms-2">{pendingReqs.length}</span>
                )}
              </h5>
              <Link to="/staff/requests" style={{ fontSize: 13, color: '#dc3545', textDecoration: 'none' }}>Manage →</Link>
            </div>
            <div className="bb-table-wrap">
              {pendingReqs.length === 0 ? (
                <div className="bb-empty"><div className="bb-empty-icon">📋</div><h6>No pending requests</h6></div>
              ) : (
                <table className="bb-table">
                  <thead><tr><th>Dept</th><th>Blood Group</th><th>Units</th><th>Date</th></tr></thead>
                  <tbody>
                    {pendingReqs.slice(0, 6).map((r) => (
                      <tr key={r.id}>
                        <td>{r.department_name}</td>
                        <td><BloodGroupBadge group={r.blood_group} /></td>
                        <td><strong>{r.units_requested}</strong></td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(r.request_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Recent donations */}
        <div className="col-12 col-lg-7">
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>💉 Recent Donations</h5>
              <Link to="/staff/donations" style={{ fontSize: 13, color: '#dc3545', textDecoration: 'none' }}>View All →</Link>
            </div>
            <div className="bb-table-wrap">
              {donations.length === 0 ? (
                <div className="bb-empty"><div className="bb-empty-icon">💉</div><h6>No donations yet</h6></div>
              ) : (
                <table className="bb-table">
                  <thead><tr><th>Donor</th><th>Blood Group</th><th>Date</th><th>Recorded By</th></tr></thead>
                  <tbody>
                    {donations.map((d) => (
                      <tr key={d.id}>
                        <td><strong>{d.donor_name}</strong></td>
                        <td><BloodGroupBadge group={d.blood_group} /></td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(d.donation_date)}</td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{d.recorded_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
