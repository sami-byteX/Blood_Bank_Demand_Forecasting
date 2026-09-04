import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../../api/axios';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import { useToast } from '../../components/ToastNotification';
import { extractError } from '../../utils/helpers';

function riskStyle(level) {
  if (level === 'HIGH')   return { background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12 };
  if (level === 'MEDIUM') return { background: '#fff3cd', color: '#d97706', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12 };
  return                         { background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12 };
}

export default function Forecasting() {
  const { show } = useToast();
  const [forecast, setForecast]   = useState([]);
  const [trendBg, setTrendBg] = useState('O+');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchForecast(); }, []);

  async function fetchForecast() {
    setLoading(true);
    try {
      const { data } = await api.get('/forecasting/forecast/');
      setForecast(data);
    } catch (err) {
      show(extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  // Build bar chart: current stock vs projected 4-week demand
  const barData = forecast.map((f) => ({
    name: f.blood_group,
    'Current Stock': f.current_stock,
    'Projected Demand (4wk)': f.projected_4wk_demand,
  }));

  // Build weekly line chart from history of first selected group (O+ by default)
  const selectedForecast = forecast.find((f) => f.blood_group === trendBg);
  const weeklyData = selectedForecast?.weekly_history?.map((w) => ({
    name: `Wk ${w.week_index}`,
    'Units Requested': w.demand,
  })) ?? [];

  const highRisk = forecast.filter((f) => f.risk_level === 'HIGH');

  return (
    <>
      <div className="bb-page-header">
        <h1>Demand Forecasting</h1>
        <p>Rolling average and linear regression projections for next 4 weeks</p>
      </div>

      {!loading && highRisk.length > 0 && (
        <div className="bb-alert danger mb-4">
          <span>⚠</span>
          <div>
            <strong>HIGH RISK:</strong> {highRisk.map((f) => `${f.blood_group} (need ${f.projected_4wk_demand}, have ${f.current_stock})`).join(' · ')}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bb-page-loader"><div className="bb-spinner" /></div>
      ) : (
        <>
          {/* Summary table */}
          <div className="bb-card mb-4">
            <div className="bb-card-header"><h5>📊 Forecast Summary — All Blood Groups</h5></div>
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>Blood Group</th>
                    <th>Avg Weekly Demand</th>
                    <th>Projected 4-Wk Demand</th>
                    <th>Current Stock</th>
                    <th>Shortfall</th>
                    <th>Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map((f) => {
                    const deficit = f.projected_4wk_demand - f.current_stock;
                    const buffer  = f.current_stock - f.projected_4wk_demand;
                    const shortfallColor = f.risk_level === 'HIGH' ? '#dc3545' : f.risk_level === 'MEDIUM' ? '#d97706' : '#198754';
                    const shortfallText  = f.risk_level === 'HIGH' ? `-${deficit}` : f.risk_level === 'MEDIUM' ? `+${buffer}` : '—';
                    return (
                      <tr key={f.blood_group} className={`forecast-risk-${f.risk_level.toLowerCase()}`}>
                        <td><BloodGroupBadge group={f.blood_group} /></td>
                        <td>{f.avg_weekly_demand}</td>
                        <td><strong>{f.projected_4wk_demand}</strong></td>
                        <td style={{ color: f.current_stock === 0 ? '#dc3545' : '#198754', fontWeight: 700 }}>
                          {f.current_stock}
                        </td>
                        <td style={{ color: shortfallColor, fontWeight: 700 }}>
                          {shortfallText}
                        </td>
                        <td><span style={riskStyle(f.risk_level)}>{f.risk_level}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar chart: stock vs demand */}
          <div className="bb-card mb-4">
            <div className="bb-card-header"><h5>📈 Current Stock vs Projected 4-Week Demand</h5></div>
            <div className="bb-card-body">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Legend />
                  <Bar dataKey="Current Stock"           fill="#198754" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Projected Demand (4wk)"  fill="#dc3545" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line chart: weekly request history */}
          <div className="bb-card">
            <div className="bb-card-header">
              <h5>📉 Weekly Request History (Last 26 Weeks)</h5>
              <select
                className="bb-form-control"
                style={{ width: 90, padding: '5px 8px', fontSize: 13 }}
                value={trendBg}
                onChange={(e) => setTrendBg(e.target.value)}
              >
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div className="bb-card-body">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={weeklyData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Units Requested"
                    stroke="#dc3545"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#dc3545' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </>
  );
}
