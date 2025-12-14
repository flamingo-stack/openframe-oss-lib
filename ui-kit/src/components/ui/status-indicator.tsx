interface StatusIndicatorProps {
  status: 'success' | 'pending' | 'error' | 'missing';
  label: string;
  href?: string;
}

export function StatusIndicator({ status, label, href }: StatusIndicatorProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-400 text-green-400';
      case 'pending':
        return 'bg-orange-400 text-orange-400';
      case 'error':
        return 'bg-red-400 text-red-400';
      case 'missing':
        return 'bg-orange-400 text-orange-400';
      default:
        return 'bg-gray-400 text-gray-400';
    }
  };

  const colorClasses = getStatusColor(status);
  const [dotColor, textColor] = colorClasses.split(' ');

  const content = (
    <div className="flex items-center gap-1.5">
      <div className={`h-3 w-3 rounded-full ${dotColor}`} />
      <span className={`text-xs font-['DM_Sans'] font-medium ${textColor}`}>
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