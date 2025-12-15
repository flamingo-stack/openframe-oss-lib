interface ImageIconProps {
  className?: string;
  color?: string;
}

export const ImageIcon = ({ className = 'w-6 h-6', color }: ImageIconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    {/* Paste image icon SVG content here */}
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2"
      stroke={color || 'currentColor'}
      strokeWidth="2"
    />
    <circle
      cx="8.5"
      cy="8.5"
      r="1.5"
      fill={color || 'currentColor'}
    />
    <path
      d="M21 15L16 10L5 21"
      stroke={color || 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
