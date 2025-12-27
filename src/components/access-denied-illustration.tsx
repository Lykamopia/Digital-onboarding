
'use client';

export function AccessDeniedIllustration() {
  return (
    <svg
      width="150"
      height="150"
      viewBox="0 0 150 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="denied-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="hsl(var(--destructive))" floodOpacity="0.2" />
        </filter>
        <linearGradient id="shield-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--muted))" />
          <stop offset="100%" stopColor="hsl(var(--background))" />
        </linearGradient>
      </defs>
      
      {/* Shield */}
      <path
        d="M75 20 L30 45 V 95 C 30 115 75 130 75 130 C 75 130 120 115 120 95 V 45 L 75 20 Z"
        fill="url(#shield-gradient)"
        stroke="hsl(var(--border))"
        strokeWidth="3"
        filter="url(#denied-shadow)"
      />
      
      {/* Keyhole */}
      <g transform="translate(0, 5)">
        <circle cx="75" cy="65" r="12" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="3" />
        <path d="M75 77 V 100 L 65 110 H 85 L 75 100" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </g>

      {/* Animated Lock Bars */}
      <g>
        <style>
          {`
            @keyframes slide-right {
              0% { transform: translateX(0); }
              40% { transform: translateX(15px); }
              60% { transform: translateX(15px); }
              100% { transform: translateX(0); }
            }
            @keyframes slide-left {
              0% { transform: translateX(0); }
              40% { transform: translateX(-15px); }
              60% { transform: translateX(-15px); }
              100% { transform: translateX(0); }
            }
            .bar-1 { animation: slide-right 3s ease-in-out infinite; }
            .bar-2 { animation: slide-left 3s ease-in-out infinite; }
          `}
        </style>
        <rect className="bar-1" x="90" y="55" width="40" height="8" rx="4" fill="hsl(var(--destructive) / 0.7)" />
        <rect className="bar-2" x="20" y="85" width="40" height="8" rx="4" fill="hsl(var(--destructive) / 0.7)" />
      </g>
    </svg>
  );
}