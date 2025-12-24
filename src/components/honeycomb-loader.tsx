
'use client';

export function HoneycombLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="telegram-loader">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="telegram-loader__plane"
        >
          <path d="M22 2L11 13" />
          <path d="m22 2-7 20-4-9-9-4Z" />
        </svg>
      </div>
      <div className="text-sm font-semibold text-primary/80 tracking-widest">LOADING...</div>
    </div>
  );
}
