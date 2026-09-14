import { Link } from "react-router-dom";

export default function EmptyState({ title, description = null, actionLabel = null, actionTo = null, onAction = null, icon: Icon = null }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl border border-dashed border-border">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-accent" />
        </div>
      )}
      <h3 className="font-display text-lg font-medium">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>}
      {actionLabel && (actionTo ? (
        <Link to={actionTo} className="mt-5 inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          {actionLabel}
        </Link>
      ) : (
        <button onClick={onAction} className="mt-5 inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          {actionLabel}
        </button>
      ))}
    </div>
  );
}