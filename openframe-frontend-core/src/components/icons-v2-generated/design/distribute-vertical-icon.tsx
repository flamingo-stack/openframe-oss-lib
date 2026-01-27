import type { SVGProps } from "react";
export interface DistributeVerticalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DistributeVerticalIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DistributeVerticalIconProps) {
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
        d="M14.874 8A.875.875 0 0 0 14 7.125h-4A.875.875 0 0 0 9.125 8v8c0 .483.392.875.875.875h4a.875.875 0 0 0 .874-.875zm2.25 8A3.125 3.125 0 0 1 14 19.125h-4A3.125 3.125 0 0 1 6.875 16V8A3.125 3.125 0 0 1 10 4.875h4A3.125 3.125 0 0 1 17.125 8v8ZM2.875 21V3a1.125 1.125 0 0 1 2.25 0v18a1.125 1.125 0 0 1-2.25 0m16 0V3a1.125 1.125 0 0 1 2.25 0v18a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
