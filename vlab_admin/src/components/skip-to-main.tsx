import { useState } from 'react';

export function SkipToMain() {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <a
      href='#content'
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={{
        position: 'fixed',
        top: isFocused ? '16px' : '-100px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        backgroundColor: '#dc2626',
        color: 'white',
        padding: '8px 16px',
        fontSize: '11px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        borderRadius: '4px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
        transition: 'top 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        textDecoration: 'none',
        outline: 'none',
      }}
    >
      Skip to Main
    </a>
  );
}
