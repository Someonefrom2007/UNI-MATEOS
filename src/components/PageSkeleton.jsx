export default function PageSkeleton({ rows = 3, header = true }) {
  return (
    <div className="space-y-4 animate-pulse">
      {header && (
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-6 w-44 bg-muted rounded-md" />
            <div className="h-3 w-64 bg-muted/70 rounded" />
          </div>
          <div className="h-9 w-24 bg-muted rounded-lg" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-24 bg-muted/60 rounded-xl" />
      ))}
    </div>
  );
}