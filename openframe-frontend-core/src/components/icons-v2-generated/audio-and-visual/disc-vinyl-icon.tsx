import type { SVGProps } from "react";
export interface DiscVinylIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DiscVinylIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: DiscVinylIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M4.875 12a1.125 1.125 0 0 1 2.25 0c0 1.803.979 3.38 2.439 4.224a1.125 1.125 0 1 1-1.128 1.947A7.12 7.12 0 0 1 4.875 12m8 0a.875.875 0 1 0-1.75 0 .875.875 0 0 0 1.75 0m4 .197c0-1.69-.86-3.18-2.17-4.056l-.269-.167-.097-.063a1.126 1.126 0 0 1 1.122-1.938l.103.053.39.243a7.12 7.12 0 0 1 3.171 5.928 1.125 1.125 0 0 1-2.25 0M15.125 12a3.125 3.125 0 1 1-6.251 0 3.125 3.125 0 0 1 6.25 0Z"
      />
    </svg>
  );
}
