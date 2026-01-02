
'use client';

export function UserProfileLoader() {
  return (
    <div className="flex items-center justify-center">
        <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Loading user profile"
        >
            <style>{`
                .user-profile-loader-shimmer {
                    animation: shimmer 2.5s ease-in-out infinite;
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
            <defs>
                <circle id="loader-circle-bg" cx="60" cy="60" r="50" fill="hsl(var(--muted))" />
                <clipPath id="loader-clip-path">
                    <circle cx="60" cy="50" r="20" />
                    <rect x="30" y="75" width="60" height="30" rx="15" />
                </clipPath>
                 <linearGradient id="shimmer-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                    <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
            </defs>
            
            <use href="#loader-circle-bg" />
            
            <g clipPath="url(#loader-clip-path)">
                <rect x="0" y="0" width="120" height="120" fill="hsl(var(--border))" />
                <rect 
                    className="user-profile-loader-shimmer"
                    x="0" 
                    y="0" 
                    width="120" 
                    height="120" 
                    fill="url(#shimmer-gradient)" 
                />
            </g>
            
            <circle cx="60" cy="60" r="50" stroke="hsl(var(--primary) / 0.2)" strokeWidth="3" fill="none" />
        </svg>
    </div>
  );
}
