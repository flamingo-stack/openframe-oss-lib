import type { SVGProps } from "react";
export interface TrendDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TrendDownIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TrendDownIconProps) {
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
        d="M2.205 6.201a1.125 1.125 0 0 1 1.505-.077l.085.077 5.397 5.396a.874.874 0 0 0 1.068.131l2.322-1.393a3.13 3.13 0 0 1 3.818.47l5.395 5.397.078.085a1.126 1.126 0 0 1-1.584 1.582l-.084-.076-5.397-5.397a.875.875 0 0 0-1.068-.132l-2.322 1.394a3.13 3.13 0 0 1-3.62-.29l-.198-.18-5.395-5.396-.078-.085a1.125 1.125 0 0 1 .078-1.506"
      />
      <path
        fill={color}
        d="M19.875 11.497a1.125 1.125 0 0 1 2.25 0L22.123 17c0 .621-.505 1.125-1.125 1.125H15.5a1.125 1.125 0 0 1 0-2.25h4.373z"
      />
    </svg>
  );
}
