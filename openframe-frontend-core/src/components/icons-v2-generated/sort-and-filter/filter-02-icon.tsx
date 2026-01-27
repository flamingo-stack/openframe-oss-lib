import type { SVGProps } from "react";
export interface Filter02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Filter02Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Filter02IconProps) {
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
        d="M15 16.875a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25zm3-6a1.125 1.125 0 0 1 0 2.25H6a1.125 1.125 0 0 1 0-2.25zm3-6a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
