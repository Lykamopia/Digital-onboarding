
'use client';

export function FavoritesEmptyIllustration() {
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
        .fav-memo-body {
            transform-origin: center;
            animation: fav-memo-float 6s ease-in-out infinite;
        }
        .fav-star-main {
            transform-origin: center;
            animation: fav-star-pulse 3s ease-in-out infinite;
        }
        .fav-sparkle {
            animation: fav-sparkle-anim 3s ease-in-out infinite;
            transform-origin: center;
            opacity: 0;
        }
        .fav-sparkle-1 { animation-delay: 0.2s; }
        .fav-sparkle-2 { animation-delay: 0.5s; }
        .fav-sparkle-3 { animation-delay: 1.1s; }
        .fav-sparkle-4 { animation-delay: 1.8s; }

        @keyframes fav-memo-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(2px); }
        }
        @keyframes fav-star-pulse {
            0%, 100% { transform: scale(1); opacity: 0.9; }
            50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes fav-sparkle-anim {
            0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
            30% { transform: scale(1) rotate(0deg); opacity: 1; }
            60% { transform: scale(0) rotate(180deg); opacity: 0; }
        }
      `}</style>
      <defs>
        <filter id="fav-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="hsl(var(--primary))" floodOpacity="0.08" />
        </filter>
        <linearGradient id="fav-star-grad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFA500" />
        </linearGradient>
      </defs>

      {/* Memo background */}
      <g className="fav-memo-body" filter="url(#fav-shadow)">
        <path
            d="M35 40 H 85 L 100 55 V 100 H 40 L 35 95 V 40 Z"
            fill="hsl(var(--muted) / 0.4)"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
        />
        <path d="M35 40 L 45 50 H 85" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
      </g>
      
      {/* Main Star */}
      <g className="fav-star-main">
        <path 
            d="M60 25 L66.9 45.5 H88.5 L70.8 58.5 L77.7 79 L60 66 L42.3 79 L49.2 58.5 L31.5 45.5 H53.1 L60 25 Z"
            fill="url(#fav-star-grad)"
            stroke="#E1A900"
            strokeWidth="2"
            strokeLinejoin="round"
        />
      </g>
      
      {/* Sparkles */}
      <path d="M60 15 L 61 12 L 62 15 L 65 16 L 62 17 L 61 20 L 60 17 L 58 16 Z" fill="#FFD700" className="fav-sparkle fav-sparkle-1" />
      <path d="M95 50 L 96 47 L 97 50 L 100 51 L 97 52 L 96 55 L 95 52 L 93 51 Z" fill="#FFD700" className="fav-sparkle fav-sparkle-2" />
      <path d="M25 60 L 26 57 L 27 60 L 30 61 L 27 62 L 26 65 L 25 62 L 23 61 Z" fill="#FFA500" className="fav-sparkle fav-sparkle-3" />
      <path d="M60 95 L 61 92 L 62 95 L 65 96 L 62 97 L 61 100 L 60 97 L 58 96 Z" fill="#FFD700" className="fav-sparkle fav-sparkle-4" />

    </svg>
  );
}
