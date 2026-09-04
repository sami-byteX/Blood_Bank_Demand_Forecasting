// ── Date helpers ────────────────────────────────────────────────────────────

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function daysFromNow(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function nextEligibleDate(lastDonation) {
  if (!lastDonation) return null;
  const d = new Date(lastDonation);
  d.setDate(d.getDate() + 56);
  return d;
}

// ── Blood group helpers ──────────────────────────────────────────────────────

const BG_COLOR_MAP = {
  'A+':  { bg: '#dbeafe', color: '#1d4ed8' },
  'A-':  { bg: '#e0e7ff', color: '#4338ca' },
  'B+':  { bg: '#dcfce7', color: '#15803d' },
  'B-':  { bg: '#d1fae5', color: '#065f46' },
  'AB+': { bg: '#fef9c3', color: '#854d0e' },
  'AB-': { bg: '#fef3c7', color: '#92400e' },
  'O+':  { bg: '#fee2e2', color: '#b91c1c' },
  'O-':  { bg: '#fce7f3', color: '#9d174d' },
};

export function bgColors(bloodGroup) {
  return BG_COLOR_MAP[bloodGroup] || { bg: '#f1f5f9', color: '#475569' };
}

export const ALL_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ── Status helpers ───────────────────────────────────────────────────────────

export function statusLabel(status) {
  const map = {
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    fulfilled: 'Fulfilled', available: 'Available', issued: 'Issued',
    expired: 'Expired', active: 'Active', inactive: 'Inactive',
  };
  return map[status] || status;
}

// ── Eligibility helpers ──────────────────────────────────────────────────────

export function eligibilityReason(profile) {
  if (!profile) return 'Profile not found';
  const { age, has_hepatitis, has_hiv, has_heart_disease, recent_surgery, last_donation_date } = profile;
  if (age < 18 || age > 65) return `Age ${age} is outside the allowed range (18–65)`;
  if (has_hepatitis) return 'Donor has Hepatitis';
  if (has_hiv) return 'Donor has HIV';
  if (has_heart_disease) return 'Donor has heart disease';
  if (recent_surgery) return 'Donor had recent surgery';
  if (last_donation_date) {
    const days = Math.floor((new Date() - new Date(last_donation_date)) / 86400000);
    if (days < 56) return `Must wait ${56 - days} more day(s) since last donation`;
  }
  return null;
}

// ── API error helper ─────────────────────────────────────────────────────────

export function extractError(err) {
  if (!err.response) return 'Network error. Please check your connection.';
  const data = err.response.data;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const val = data[firstKey];
    return `${firstKey}: ${Array.isArray(val) ? val[0] : val}`;
  }
  return 'An unexpected error occurred.';
}

// ── Pagination helper ────────────────────────────────────────────────────────

export function paginate(items, page, pageSize = 10) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(count, pageSize = 10) {
  return Math.max(1, Math.ceil(count / pageSize));
}
