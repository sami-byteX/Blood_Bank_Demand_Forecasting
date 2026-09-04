export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel, loading = false }) {
  return (
    <div className="bb-modal-backdrop" onClick={onCancel}>
      <div className="bb-modal" onClick={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
        <p>{message}</p>
        <div className="bb-modal-actions">
          <button className="btn-bb-outline" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn-bb-primary"
            style={danger ? {} : { background: '#198754' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <><span className="spinner-border spinner-border-sm me-1" />Working…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
