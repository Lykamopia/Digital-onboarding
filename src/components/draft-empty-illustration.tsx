
'use client';

export function DraftEmptyIllustration() {
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
        .draft-pen { animation: write 3s ease-in-out infinite; }
        .draft-line { 
          stroke-dasharray: 50; 
          stroke-dashoffset: 50;
          animation: draw 3s ease-in-out infinite;
        }
        @keyframes write {
          0%, 20%, 100% { transform: translate(0, 0) rotate(0deg); }
          40% { transform: translate(5px, -2px) rotate(5deg); }
          60% { transform: translate(-2px, 3px) rotate(-3deg); }
          80% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes draw {
          0%, 30% { stroke-dashoffset: 50; }
          80% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
      <defs>
        <filter id="draft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="hsl(var(--primary))" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Paper */}
      <path
        d="M30 25 H 90 L 105 40 V 95 H 45 L 30 80 V 25 Z"
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth="2"
        filter="url(#draft-shadow)"
      />
      <path d="M30 25 L 45 40 H 90" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
      <path d="M45 40 V 80" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
      
      {/* Animated line */}
      <path d="M50 60 H 90" className="draft-line" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />

      {/* Pen */}
      <g className="draft-pen" transform="translate(25, 45) rotate(-30)">
        <path d="M70 20 L 75 25 L 50 50 L 45 45 Z" fill="hsl(var(--accent))" stroke="hsl(var(--accent-foreground))" strokeWidth="1.5" />
        <rect x="47" y="17" width="26" height="8" rx="3" transform="rotate(45 47 17)" fill="hsl(var(--accent) / 0.8)" />
        <path d="M70 20 L 71 19" stroke="hsl(var(--accent-foreground))" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
