export default function EmptyState({ icon = '📋', title = 'No records found', message = 'Nothing to display yet.' }) {
  return (
    <div className="bb-empty">
      <div className="bb-empty-icon">{icon}</div>
      <h6>{title}</h6>
      <p>{message}</p>
    </div>
  );
}
