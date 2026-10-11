import type { SVGProps } from "react";
export interface EyeOffClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EyeOffClassicIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EyeOffClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke={color}
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="m3 3 18 18M10.584 10.587a2 2 0 1 0 2.829 2.829" />
      <path d="M16.681 16.681A9 9 0 0 0 12 18c-5 0-9-6-9-6a15.7 15.7 0 0 1 3.555-3.873M9.878 4.592A9 9 0 0 1 12 4c5 0 9 6 9 6a15.6 15.6 0 0 1-2.24 2.78" />
    </svg>
  );
}
