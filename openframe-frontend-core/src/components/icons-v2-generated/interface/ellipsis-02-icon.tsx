import type { SVGProps } from "react";
export interface Ellipsis02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Ellipsis02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Ellipsis02IconProps) {
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
        d="M12.217 16.885a2.126 2.126 0 1 1-2.332 2.332l-.01-.216.01-.219a2.126 2.126 0 0 1 2.116-1.907zm0-6.999a2.125 2.125 0 1 1-2.332 2.332l-.01-.219.01-.216a2.126 2.126 0 0 1 2.116-1.908zm0-7a2.126 2.126 0 1 1-2.332 2.331L9.875 5l.01-.218a2.126 2.126 0 0 1 2.116-1.907l.216.01Z"
      />
    </svg>
  );
}
