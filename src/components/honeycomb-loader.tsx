
'use client';

export function HoneycombLoader() {
  return (
    <div className="honeycomb-loader">
        <div className="honeycomb-cell">
            <div className="honeycomb-cell__inner">
                <div className="honeycomb-cell__honey"></div>
            </div>
        </div>
        <div className="text-sm mt-4 font-semibold text-primary/80 tracking-widest">LOADING...</div>
    </div>
  );
}
