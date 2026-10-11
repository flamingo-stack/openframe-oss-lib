import type { SVGProps } from "react";
export interface ShieldClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShieldClassicIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: ShieldClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 22S2 17 2 9V4l10-2 10 2v5c0 8-10 13-10 13"
      />
      <path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="m9 12 1.5 1.5L16 8"
      />
    </svg>
  );
}
