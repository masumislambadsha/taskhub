interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="material-symbols-outlined text-6xl text-primary/20 mb-4">
        {icon}
      </span>
      <h3 className="text-lg font-bold text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-primary/60 text-sm max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
