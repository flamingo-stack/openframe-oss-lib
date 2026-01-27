import type { SVGProps } from "react";
export interface SortItemDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SortItemDownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SortItemDownIconProps) {
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
        d="m14.5 14.875.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H11a1.125 1.125 0 0 1 0-2.25zm2.5-4 .116.005a1.126 1.126 0 0 1 0 2.239l-.116.005h-6a1.125 1.125 0 0 1 0-2.25zm2.5-4 .115.006a1.126 1.126 0 0 1 0 2.239l-.114.005H11a1.125 1.125 0 0 1 0-2.25zm2.5-4 .115.006a1.125 1.125 0 0 1 0 2.238L22 5.125H11a1.125 1.125 0 0 1 0-2.25zM3.875 3v15.284l-1.08-1.08a1.125 1.125 0 1 0-1.59 1.591l3 3 .085.078c.441.36 1.094.334 1.505-.078l3-3 .078-.085a1.125 1.125 0 0 0-1.583-1.583l-.085.078-1.08 1.08V3a1.125 1.125 0 0 0-2.25 0"
      />
    </svg>
  );
}
