import type { SVGProps } from "react";
export interface BuildingsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BuildingsIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BuildingsIconProps) {
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
        d="M1.875 21V6A4.125 4.125 0 0 1 6 1.875h5a4.12 4.12 0 0 1 4.119 4H19A3.125 3.125 0 0 1 22.125 9v12a1.125 1.125 0 0 1-2.25 0V9A.875.875 0 0 0 19 8.125h-3.876V21a1.125 1.125 0 0 1-2.25 0V6a1.874 1.874 0 0 0-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v15a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M9.375 17a.876.876 0 1 0-1.75 0v2.875h1.75zM18 13.874l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.006H17a1.125 1.125 0 0 1 0-2.25zM7 9.875l.115.006a1.125 1.125 0 0 1 0 2.239L7 12.126H6a1.125 1.125 0 0 1 0-2.25zm4 0 .116.006a1.125 1.125 0 0 1 0 2.239l-.116.006h-1a1.126 1.126 0 0 1 0-2.25h1Zm7 0 .115.006a1.126 1.126 0 0 1 0 2.239l-.114.006H17a1.125 1.125 0 0 1 0-2.25h1Zm-11-4 .115.006a1.125 1.125 0 0 1 0 2.238L7 8.125H6a1.125 1.125 0 0 1 0-2.25zm4 0 .116.006a1.125 1.125 0 0 1 0 2.238L11 8.125h-1a1.125 1.125 0 0 1 0-2.25zm.626 14H22a1.125 1.125 0 0 1 0 2.25H2a1.125 1.125 0 0 1 0-2.25h3.375V17a3.126 3.126 0 1 1 6.25 0z"
      />
    </svg>
  );
}
