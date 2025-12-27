
'use client';

export function SentEmptyIllustration() {
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
        .sent-plane {
            animation: fly-plane 3s ease-out infinite;
            transform-origin: center;
        }
        .sent-trail {
            stroke-dasharray: 200;
            stroke-dashoffset: 200;
            animation: draw-trail 3s ease-out infinite;
        }
        @keyframes fly-plane {
            0% { transform: translate(-20px, 20px) scale(0.8); opacity: 0; }
            20% { transform: translate(0, 0) scale(1); opacity: 1; }
            80% { transform: translate(60px, -60px) scale(1.2); opacity: 1; }
            100% { transform: translate(80px, -80px) scale(1.2); opacity: 0; }
        }
        @keyframes draw-trail {
            0%, 20% { stroke-dashoffset: 200; }
            90% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: 0; opacity: 0;}
        }
      `}</style>
      <defs>
        <filter id="sent-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="hsl(var(--primary))" floodOpacity="0.1" />
        </filter>
        <linearGradient id="sent-trail-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
        </linearGradient>
      </defs>

      {/* Trail */}
      <path 
        d="M30 90 C 50 70, 70 70, 100 40"
        stroke="url(#sent-trail-grad)"
        strokeWidth="2"
        fill="none"
        className="sent-trail"
        strokeLinecap="round"
      />

      {/* Paper Plane */}
      <g className="sent-plane" filter="url(#sent-shadow)">
        <path
            d="M30 90 L 90 70 L 40 80 Z"
            fill="hsl(var(--primary) / 0.8)"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path
            d="M40 80 L 55 55 L 90 70"
            fill="hsl(var(--primary))"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
