import type { SVGProps } from "react";
export interface MoonClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MoonClassicIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: MoonClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 23 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M9.375 6.696c0-1.157.182-2.272.519-3.32a8.875 8.875 0 1 0 9.11 14.073c-5.415-.593-9.629-5.18-9.629-10.753m2.25 0a8.57 8.57 0 0 0 9.285 8.542 1.127 1.127 0 0 1 1.104 1.613 11.13 11.13 0 0 1-10.013 6.274C5.856 23.125.875 18.145.875 12 .875 5.964 5.682 1.05 11.677.879a1.126 1.126 0 0 1 1.016 1.67 8.5 8.5 0 0 0-1.067 4.147"
      />
    </svg>
  );
}
