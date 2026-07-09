import React from 'react';
import { parseBulletedListField } from '@/lib/bulletedListField';

/** Read-only bullet list for family, program, and admin views. */
export default function BulletedListDisplay({
  value,
  emptyText = '—',
  className = '',
  style,
  listStyle = 'disc',
}) {
  const items = parseBulletedListField(value).filter(Boolean);
  if (!items.length) {
    return (
      <span className={className} style={{ color: '#94a3b8', ...style }}>
        {emptyText}
      </span>
    );
  }
  return (
    <ul
      className={className}
      style={{
        margin: 0,
        paddingLeft: 20,
        listStyleType: listStyle,
        ...style,
      }}
    >
      {items.map((item, index) => (
        <li key={index} style={{ marginBottom: index < items.length - 1 ? 6 : 0 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}
