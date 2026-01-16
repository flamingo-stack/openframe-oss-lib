import type { SVGProps } from "react";
export interface DistributeHorizontalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DistributeHorizontalIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: DistributeHorizontalIconProps) {
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
        d="M16.857 9.824A.875.875 0 0 0 16 9.125H8a.875.875 0 0 0-.875.875v4c0 .483.391.874.875.874h8c.423 0 .776-.3.857-.698l.018-.176v-4zM19.125 14A3.125 3.125 0 0 1 16 17.125H8A3.125 3.125 0 0 1 4.875 14v-4A3.125 3.125 0 0 1 8 6.875h8A3.125 3.125 0 0 1 19.125 10zM21 18.875l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H3a1.125 1.125 0 0 1 0-2.25zm0-16a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
