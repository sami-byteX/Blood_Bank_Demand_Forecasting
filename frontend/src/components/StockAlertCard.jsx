import BloodGroupBadge from './BloodGroupBadge';

export default function StockAlertCard({ bloodGroup, available }) {
  const level = available > 10 ? 'high' : available >= 5 ? 'medium' : 'low';
  const levelLabel = { high: 'Sufficient', medium: 'Moderate', low: 'Critical' }[level];
  return (
    <div className={`stock-card ${level}`}>
      <div className="sc-group"><BloodGroupBadge group={bloodGroup} /></div>
      <div className="sc-count">{available}</div>
      <div className="sc-label">units available</div>
      <div style={{ marginTop: 6 }}>
        <span className={`status-badge ${level === 'high' ? 'available' : level === 'medium' ? 'pending' : 'rejected'}`}>
          {levelLabel}
        </span>
      </div>
    </div>
  );
}
