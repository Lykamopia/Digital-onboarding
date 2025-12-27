
'use client';

export function MemoEmptyIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="hsl(var(--primary))" floodOpacity="0.1" />
        </filter>
        <clipPath id="clip-plane">
            <path d="M105 15 L25 50 L45 55 L58 95 L65 85 L60 58 Z" />
        </clipPath>
      </defs>

      {/* Back memo page */}
      <path
        d="M20 35 H 80 L 95 50 V 105 H 35 L 20 90 V 35 Z"
        fill="hsl(var(--background))"
        stroke="hsl(var(--border))"
        strokeWidth="2"
        filter="url(#shadow)"
      />
      <path d="M20 35 L 35 50 H 80" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
      <path d="M35 50 V 90" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
      
      {/* Middle memo page */}
      <path
        d="M25 30 H 85 L 100 45 V 100 H 40 L 25 85 V 30 Z"
        fill="hsl(var(--background))"
        stroke="hsl(var(--border))"
        strokeWidth="2"
        filter="url(#shadow)"
      />
      <path d="M25 30 L 40 45 H 85" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
      <path d="M40 45 V 85" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />

      {/* Front memo page (main) */}
      <g>
        <path
          d="M30 25 H 90 L 105 40 V 95 H 45 L 30 80 V 25 Z"
          fill="hsl(var(--card))"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
        />
        <path d="M30 25 L 45 40 H 90" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />
        <path d="M45 40 V 80" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />

        <rect x="52" y="50" width="40" height="4" rx="2" fill="hsl(var(--border))" />
        <rect x="52" y="60" width="45" height="4" rx="2" fill="hsl(var(--border))" />
        <rect x="52" y="70" width="35" height="4" rx="2" fill="hsl(var(--border))" />
      </g>

      {/* Paper airplane */}
      <g transform="rotate(15 65 55) translate(0, -5)">
        <path
          d="M105 15 L25 50 L45 55 L58 95 L65 85 L60 58 Z"
          fill="hsl(var(--accent) / 0.8)"
          stroke="hsl(var(--accent-foreground))"
          strokeWidth="2"
          strokeLinejoin="round"
          filter="url(#shadow)"
        />
        <path d="M45 55 L 105 15" stroke="hsl(var(--accent-foreground))" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M45 55 L 58 95" stroke="hsl(var(--accent-foreground))" strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

    
