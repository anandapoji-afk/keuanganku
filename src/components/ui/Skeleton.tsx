import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

type Variant = 'ringkasan' | 'daftar' | 'kartu' | 'form';

function BarisDaftar({ n = 6 }: { n?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-4 w-20 self-start" />
        </div>
      ))}
    </div>
  );
}

// Bentuk skeleton dibuat mirip layout asli tiap halaman, jadi saat data
// datang konten "mengisi" tempat yang sama tanpa loncat.
export function PageSkeleton({ variant = 'daftar' }: { variant?: Variant }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-3">
      <span className="sr-only">Memuat data...</span>

      {variant === 'ringkasan' && (
        <>
          <Skeleton className="h-36 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-28 rounded-2xl" />
          <BarisDaftar n={3} />
        </>
      )}

      {variant === 'daftar' && (
        <>
          <Skeleton className="h-9 rounded-xl" />
          <div className="flex gap-1.5 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-xl shrink-0" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
          <BarisDaftar n={6} />
        </>
      )}

      {variant === 'kartu' && (
        <>
          <Skeleton className="h-8 w-32 ml-auto rounded-lg" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3.5 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </>
      )}

      {variant === 'form' && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-9 rounded-xl" />
              <Skeleton className="h-9 rounded-xl" />
            </div>
            <Skeleton className="h-9 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
          <BarisDaftar n={3} />
        </>
      )}
    </div>
  );
}

export default PageSkeleton;
