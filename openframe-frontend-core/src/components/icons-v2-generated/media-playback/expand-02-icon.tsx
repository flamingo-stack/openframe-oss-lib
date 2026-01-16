import type { SVGProps } from "react";
export interface Expand02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Expand02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Expand02IconProps) {
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
        d="M22.125 8.501a1.125 1.125 0 0 1-2.25 0V5.716l-4.08 4.08a1.125 1.125 0 0 1-1.59-1.59l4.08-4.08H15.5a1.125 1.125 0 0 1 0-2.25H21c.622 0 1.125.503 1.125 1.124zm-13.92 5.704a1.125 1.125 0 1 1 1.59 1.59l-4.079 4.08h2.785l.114.006a1.126 1.126 0 0 1 0 2.239l-.114.005H3A1.125 1.125 0 0 1 1.874 21v-5.5a1.125 1.125 0 0 1 2.25 0v2.785z"
      />
    </svg>
  );
}
