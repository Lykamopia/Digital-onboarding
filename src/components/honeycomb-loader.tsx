
'use client';

export function HoneycombLoader() {
  return (
    <div className="flex items-center justify-center">
       <div className="paper-plane-loader">
        <svg
            className="paper-plane-loader__plane"
            viewBox="0 0 24 24"
            width="48px"
            height="48px"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
            d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
            ></path>
        </svg>
       </div>
    </div>
  );
}
