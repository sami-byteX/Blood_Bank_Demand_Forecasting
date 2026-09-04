import { bgColors } from '../utils/helpers';

export default function BloodGroupBadge({ group, size = 'sm' }) {
  if (!group) return <span className="text-muted">—</span>;
  const { bg, color } = bgColors(group);
  const padding = size === 'lg' ? '4px 14px' : '2px 10px';
  const fontSize = size === 'lg' ? '14px' : '12px';
  return (
    <span style={{
      display: 'inline-block',
      background: bg, color, padding,
      borderRadius: '20px', fontWeight: 700,
      fontSize, letterSpacing: '0.03em',
    }}>
      {group}
    </span>
  );
}
