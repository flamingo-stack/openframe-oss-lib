"use client"

interface StatusIndicatorProps {
  status: 'success' | 'pending' | 'error' | 'missing';
  label: string;
  href?: string;
}

export function StatusIndicator({ status, label, href }: StatusIndicatorProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-ods-success text-ods-success';
      case 'pending':
        return 'bg-ods-warning text-ods-warning';
      case 'error':
        return 'bg-ods-error text-ods-error';
      case 'missing':
        return 'bg-ods-warning text-ods-warning';
      default:
        return 'bg-ods-text-muted text-ods-text-muted';
    }
  };

  const colorClasses = getStatusColor(status);
  const [dotColor, textColor] = colorClasses.split(' ');

  const content = (
    <div className="flex items-center gap-1.5">
      <div className={`h-3 w-3 rounded-full ${dotColor}`} />
      <span className={`text-h6 ${textColor}`}>
        {label}
      </span>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline cursor-pointer"
      >
        {content}
      </a>
    );
  }

  return content;
}