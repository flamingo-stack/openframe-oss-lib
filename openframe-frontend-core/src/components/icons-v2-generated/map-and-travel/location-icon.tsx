import type { SVGProps } from "react";
export interface LocationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LocationIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LocationIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M18.875 10c0-3.63-3.095-6.875-6.876-6.875-3.78 0-6.874 3.245-6.874 6.875v.547l.012.41c.118 2.039 1.107 3.997 2.41 5.712 1.383 1.817 3.037 3.25 4.085 4.07a.58.58 0 0 0 .737 0c1.048-.82 2.7-2.253 4.082-4.07 1.39-1.829 2.424-3.935 2.424-6.122zm2.25.547c0 2.884-1.348 5.467-2.882 7.484-1.543 2.029-3.36 3.599-4.487 4.481a2.834 2.834 0 0 1-3.511 0c-1.128-.882-2.944-2.452-4.487-4.48-1.439-1.892-2.713-4.28-2.867-6.947l-.016-.538V10c0-4.839 4.069-9.125 9.124-9.125 5.057 0 9.126 4.286 9.126 9.125z"
      />
      <path
        fill={color}
        d="M13.875 10a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 0a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0"
      />
    </svg>
  );
}
