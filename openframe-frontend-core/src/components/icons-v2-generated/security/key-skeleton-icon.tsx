import type { SVGProps } from "react";
export interface KeySkeletonIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function KeySkeletonIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: KeySkeletonIconProps) {
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
        d="M12.523 9.887a1.125 1.125 0 0 1 1.59 1.59L3.796 21.796a1.125 1.125 0 0 1-1.59-1.591L3.91 18.5l-1.705-1.705-.078-.085a1.126 1.126 0 0 1 1.583-1.582l.085.076L5.5 16.909l1.41-1.41-1.705-1.704-.078-.085a1.126 1.126 0 0 1 1.583-1.582l.085.076L8.5 13.909z"
      />
      <path
        fill={color}
        d="M19.875 7.5a3.375 3.375 0 1 0-6.75 0 3.375 3.375 0 0 0 6.75 0m2.25 0a5.625 5.625 0 1 1-11.25 0 5.625 5.625 0 0 1 11.25 0"
      />
    </svg>
  );
}
