import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/ToastNotification';
import { extractError, formatDate } from '../../utils/helpers';

export default function Inventory() {
  const { show } = useToast();
  const [inventory, setInventory]   = useState([]);
  const [expiring, setExpiring]     = useState([]);
  const [lowStock, setLowStock]     = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [invRes, expRes, lowRes] = await Promise.all([
        api.get('/inventory/'),
        api.get('/inventory/expiry-alerts/'),
        api.get('/inventory/low-stock/'),
      ]);
      setInventory(invRes.data);
      setExpiring(expRes.data);
      setLowStock(lowRes.data);
    } catch (err) {
      show(extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  function stockLevel(available) {
    if (available > 10) return 'high';
    if (available >= 5) return 'medium';
    return 'low';
  }

  const chartData = inventory.map((i) => ({
    name: i.blood_group,
    Available: i.available,
    Expired: i.expired,
  }));

  return (
    <>
      <div className="bb-page-header">
        <h1>Inventory Management</h1>
        <p>Real-time blood inventory status across all blood groups</p>
      </div>

      {/* Alerts */}
      {!loading && lowStock.length > 0 && (
        <div className="bb-alert warning mb-4">
          <span>⚠</span>
          <div>
            <strong>Low Stock Alert:</strong>{' '}
            {lowStock.map((s) => `${s.blood_group} (${s.available} units)`).join(' · ')}
          </div>
        </div>
      )}
      {!loading && expiring.length > 0 && (
        <div className="bb-alert danger mb-4">
          <span>⚠</span>
          <div>
            <strong>{expiring.length} unit(s) expiring within 7 days.</strong>{' '}
            <span style={{ fontSize: 13 }}>Review expiry alerts below.</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bb-page-loader"><div className="bb-spinner" /></div>
      ) : (
        <>
          {/* Blood group grid */}
          <div className="bb-card mb-4">
            <div className="bb-card-header"><h5>🩸 Stock Levels by Blood Group</h5></div>
            <div className="bb-card-body">
              <div className="row g-3">
                {inventory.map((i) => {
                  const level = stockLevel(i.available);
                  const colors = { high: '#198754', medium: '#d97706', low: '#dc3545' };
                  return (
                    <div key={i.blood_group} className="col-6 col-sm-4 col-md-3">
                      <div className={`stock-card ${level}`}>
                        <div className="sc-group"><BloodGroupBadge group={i.blood_group} /></div>
                        <div className="sc-count" style={{ color: colors[level] }}>{i.available}</div>
                        <div className="sc-label">available</div>
                        <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                          <div>Issued: <strong style={{ color: '#3b82f6' }}>{i.issued}</strong></div>
                          <div>Expired: <strong style={{ color: '#dc3545' }}>{i.expired}</strong></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bb-card mb-4">
            <div className="bb-card-header">
              <h5>📊 Current Stock Distribution</h5>
              <span style={{ fontSize: 12, color: '#64748b' }}>Available &amp; Expired units in storage — issued units are excluded</span>
            </div>
            <div className="bb-card-body">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Available" fill="#198754" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expired"   fill="#dc3545" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary table */}
          <div className="bb-card mb-4">
            <div className="bb-card-header"><h5>📋 Inventory Summary Table</h5></div>
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr><th>Blood Group</th><th>Available</th><th>Issued</th><th>Expired</th><th>Total</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {inventory.map((i) => {
                    const level = stockLevel(i.available);
                    return (
                      <tr key={i.blood_group}>
                        <td><BloodGroupBadge group={i.blood_group} /></td>
                        <td><strong style={{ color: '#198754' }}>{i.available}</strong></td>
                        <td style={{ color: '#3b82f6' }}>{i.issued}</td>
                        <td style={{ color: '#dc3545' }}>{i.expired}</td>
                        <td>{i.total}</td>
                        <td>
                          <span className={`status-badge ${level === 'high' ? 'available' : level === 'medium' ? 'pending' : 'rejected'}`}>
                            {level === 'high' ? 'Sufficient' : level === 'medium' ? 'Moderate' : 'Critical'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expiry alerts */}
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>⏰ Expiry Alerts (Next 7 Days)</h5>
              <span style={{ fontSize: 13, color: '#dc3545', fontWeight: 700 }}>{expiring.length} unit(s)</span>
            </div>
            {expiring.length === 0 ? (
              <EmptyState icon="✅" title="No units expiring soon" message="All available units are well within their expiry dates." />
            ) : (
              <div className="bb-table-wrap">
                <table className="bb-table">
                  <thead>
                    <tr><th>Unit #</th><th>Blood Group</th><th>Expiry Date</th><th>Days Left</th></tr>
                  </thead>
                  <tbody>
                    {expiring.map((u) => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td><BloodGroupBadge group={u.blood_group} /></td>
                        <td>{formatDate(u.expiry_date)}</td>
                        <td>
                          <span className={`status-badge ${u.days_until_expiry <= 3 ? 'rejected' : 'pending'}`}>
                            {u.days_until_expiry} day(s)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
