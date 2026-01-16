import type { SVGProps } from "react";
export interface CodingBranchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodingBranchIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CodingBranchIconProps) {
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
        d="M4.375 16V8a1.125 1.125 0 0 1 2.25 0v3.33a4.1 4.1 0 0 1 1.875-.454h7c1.036 0 1.875-.84 1.875-1.876V8a1.125 1.125 0 0 1 2.25 0v1a4.126 4.126 0 0 1-4.124 4.126H8.5a1.874 1.874 0 0 0-1.875 1.875v.998l-.006.116A1.125 1.125 0 0 1 4.375 16"
      />
      <path
        fill={color}
        d="M6.875 18.5a1.374 1.374 0 1 0-2.749 0 1.374 1.374 0 0 0 2.749 0m0-13a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m13 0a1.376 1.376 0 1 0-2.752.001 1.376 1.376 0 0 0 2.752 0Zm-10.75 13a3.625 3.625 0 1 1-7.25 0 3.625 3.625 0 0 1 7.25 0m0-13a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0m13 0a3.625 3.625 0 1 1-7.25-.001 3.625 3.625 0 0 1 7.25.001"
      />
    </svg>
  );
}
