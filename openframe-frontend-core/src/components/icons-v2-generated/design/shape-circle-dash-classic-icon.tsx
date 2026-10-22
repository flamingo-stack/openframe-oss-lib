import type { SVGProps } from "react";
export interface ShapeCircleDashClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShapeCircleDashClassicIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: ShapeCircleDashClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <circle
        cx={12}
        cy={12}
        r={9}
        stroke={color}
        strokeDasharray="4 2"
        strokeLinecap="round"
      />
    </svg>
  );
}
