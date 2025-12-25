
'use client';

export function HoneycombLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
       <div className="telegram-loader">
        <svg
            className="telegram-loader__plane"
            viewBox="0 0 24 24"
            width="24px"
            height="24px"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
            fill="currentColor"
            d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
            ></path>
        </svg>
       </div>
      <div className="text-sm font-semibold text-primary/80 tracking-widest uppercase">Sending...</div>
    </div>
  );
}
