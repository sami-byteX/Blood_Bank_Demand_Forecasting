export default function KPIStatCard({ icon, label, value, color = 'red', loading = false }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div>
        <div className="kpi-value">
          {loading ? <span className="placeholder col-4 rounded" style={{ height: 28 }} /> : (value ?? '—')}
        </div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}
