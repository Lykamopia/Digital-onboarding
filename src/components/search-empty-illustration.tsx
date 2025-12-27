
'use client';

export function SearchEmptyIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <style>{`
        .search-magnifier { animation: peek 4s ease-in-out infinite; }
        .search-question-mark { 
            transform-origin: center;
            animation: question-fade 4s ease-in-out infinite;
        }
        @keyframes peek {
          0%, 100% { transform: translate(0, 0) rotate(0); }
          25% { transform: translate(5px, -8px) rotate(15deg); }
          50% { transform: translate(-3px, 5px) rotate(-10deg); }
          75% { transform: translate(0, 0) rotate(0); }
        }
        @keyframes question-fade {
            0%, 20%, 100% { opacity: 0; transform: scale(0.8); }
            30% { opacity: 1; transform: scale(1.1); }
            40%, 80% { opacity: 1; transform: scale(1); }
            90% { opacity: 0; transform: scale(0.8); }
        }
      `}</style>
      <defs>
        <filter id="search-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="hsl(var(--primary))" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Faded background document */}
      <path
        d="M35 30 H 85 L 100 45 V 90 H 40 L 35 85 V 30 Z"
        fill="hsl(var(--muted) / 0.5)"
        stroke="hsl(var(--border))"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      
      {/* Magnifying glass */}
      <g className="search-magnifier" filter="url(#search-shadow)">
        <circle cx="60" cy="55" r="20" stroke="hsl(var(--primary))" strokeWidth="4" fill="hsl(var(--card) / 0.8)" />
        <line x1="75" y1="70" x2="90" y2="85" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" />
      </g>
      
      {/* Question mark inside magnifier */}
      <text 
        x="60" 
        y="62" 
        fontFamily="Arial, sans-serif" 
        fontSize="24" 
        fontWeight="bold"
        textAnchor="middle" 
        fill="hsl(var(--primary))"
        className="search-question-mark"
      >
        ?
      </text>
    </svg>
  );
}
