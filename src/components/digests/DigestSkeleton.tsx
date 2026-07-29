export function DigestSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-outline-variant bg-surface p-6">
      <div className="h-3 w-24 rounded bg-surface-variant" />
      <div className="mt-4 h-6 w-2/3 rounded bg-surface-variant" />
      <div className="mt-6 space-y-2">
        <div className="h-3 w-full rounded bg-surface-variant" />
        <div className="h-3 w-full rounded bg-surface-variant" />
        <div className="h-3 w-3/4 rounded bg-surface-variant" />
      </div>
      <div className="mt-6 h-4 w-1/3 rounded bg-surface-variant" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-surface-variant" />
        <div className="h-3 w-2/3 rounded bg-surface-variant" />
      </div>
    </div>
  );
}
