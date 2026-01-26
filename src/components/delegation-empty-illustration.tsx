
'use client';

export function DelegationEmptyIllustration() {
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
        .delegation-user-main { animation: delegation-float-main 4s ease-in-out infinite; }
        .delegation-user-delegate { animation: delegation-float-delegate 4s ease-in-out infinite; }
        .delegation-key-path { 
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: delegation-draw-key 4s ease-in-out infinite; 
        }
        @keyframes delegation-float-main {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes delegation-float-delegate {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
        @keyframes delegation-draw-key {
            0%, 20% { stroke-dashoffset: 100; }
            50% { stroke-dashoffset: 0; }
            80%, 100% { stroke-dashoffset: 0; }
        }
      `}</style>
      <defs>
        <filter id="delegation-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="hsl(var(--primary))" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Main User */}
      <g className="delegation-user-main" filter="url(#delegation-shadow)">
        <circle cx="45" cy="50" r="20" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" strokeWidth="2" />
        <path d="M45 70 C 35 70, 30 80, 45 90 C 60 80, 55 70, 45 70 Z" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" strokeWidth="2" />
        <circle cx="45" cy="45" r="8" fill="hsl(var(--primary) / 0.2)" />
        <path d="M45 53 C 40 58, 50 58, 45 53 Z" fill="hsl(var(--primary) / 0.2)" />
      </g>

      {/* Delegate User */}
      <g className="delegation-user-delegate" filter="url(#delegation-shadow)">
        <circle cx="75" cy="70" r="15" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
        <path d="M75 85 C 68 85, 65 92, 75 100 C 85 92, 82 85, 75 85 Z" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
        <circle cx="75" cy="66" r="6" fill="hsl(var(--muted))" />
        <path d="M75 72 C 72 76, 78 76, 75 72 Z" fill="hsl(var(--muted))" />
      </g>

      {/* Key Path */}
      <g>
        <path className="delegation-key-path" d="M60 60 L 80 40" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="85" cy="35" r="5" fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" className="delegation-key-path" />
        <line x1="90" y1="35" x2="94" y2="35" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" className="delegation-key-path" />
        <line x1="85" y1="30" x2="85" y2="26" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" className="delegation-key-path" />
      </g>
    </svg>
  );
}
