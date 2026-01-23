import type { SVGProps } from "react";
export interface DotIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DotIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DotIconProps) {
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
      <circle cx={12} cy={12} r={3} fill={color} />
    </svg>
  );
}
