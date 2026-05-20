import React from 'react';

export default function EtaLabel({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-block',
        padding: '8px 18px',
        background: '#1A73E8',
        color: '#fff',
        borderRadius: '16px',
        fontWeight: 600,
        fontSize: '16px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(26,115,232,0.18)',
        margin: '12px 0',
        transition: 'background 0.2s',
        border: 'none',
      }}
      aria-label="Show ETA details"
    >
      {label}
    </button>
  );
}
