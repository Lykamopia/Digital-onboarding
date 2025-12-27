
'use client';

export function InboxEmptyIllustration() {
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
        .inbox-check {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: draw-check 3s ease-in-out infinite;
        }
        @keyframes draw-check {
          0%, 30% { stroke-dashoffset: 100; }
          60% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 0; }
        }
        .inbox-star {
            transform-origin: center;
            animation: pop-star 3s ease-in-out infinite;
        }
        @keyframes pop-star {
            0%, 60% { transform: scale(0); opacity: 0; }
            80% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }
        .inbox-star-1 { animation-delay: 0.1s; }
        .inbox-star-2 { animation-delay: 0.2s; }
        .inbox-star-3 { animation-delay: 0.3s; }
      `}</style>
      <defs>
        <filter id="inbox-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="hsl(var(--primary))" floodOpacity="0.1" />
        </filter>
        <linearGradient id="inbox-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent))" />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
        </linearGradient>
      </defs>

      {/* Main shape */}
      <path
        d="M30 40 H 90 V 90 H 30 V 40 Z M 25 45 H 95 M 30 40 L 60 65 L 90 40"
        stroke="hsl(var(--border))"
        strokeWidth="3"
        fill="hsl(var(--card))"
        filter="url(#inbox-shadow)"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Checkmark */}
      <path className="inbox-check" d="M50 65 L 60 75 L 75 55" stroke="url(#inbox-grad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    
      {/* Stars */}
      <path className="inbox-star inbox-star-1" d="M40 30 L 42 35 L 47 36 L 43 40 L 44 45 L 40 42 L 36 45 L 37 40 L 33 36 L 38 35 Z" fill="hsl(var(--accent) / 0.8)"/>
      <path className="inbox-star inbox-star-2" d="M80 35 L 82 40 L 87 41 L 83 45 L 84 50 L 80 47 L 76 50 L 77 45 L 73 41 L 78 40 Z" fill="hsl(var(--primary) / 0.7)"/>
      <path className="inbox-star inbox-star-3" d="M25 70 L 27 75 L 32 76 L 28 80 L 29 85 L 25 82 L 21 85 L 22 80 L 18 76 L 23 75 Z" fill="hsl(var(--accent) / 0.6)"/>
    </svg>
  );
}
