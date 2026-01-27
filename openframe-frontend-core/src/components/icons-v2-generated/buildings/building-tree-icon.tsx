import type { SVGProps } from "react";
export interface BuildingTreeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BuildingTreeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BuildingTreeIconProps) {
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
        d="M9.375 21v-4a.876.876 0 1 0-1.75 0v4a1.125 1.125 0 0 1-2.25 0v-4a3.126 3.126 0 1 1 6.25 0v4a1.125 1.125 0 0 1-2.25 0m11.5-10.5a1.375 1.375 0 0 0-2.75 0v4a1.376 1.376 0 0 0 2.75 0zM7 9.874a1.125 1.125 0 0 1 0 2.25H6a1.125 1.125 0 0 1 0-2.25zm4 0 .115.006a1.125 1.125 0 0 1 0 2.239l-.116.006h-.998a1.125 1.125 0 0 1 0-2.25zm-4-4a1.125 1.125 0 0 1 0 2.25H6a1.125 1.125 0 0 1 0-2.25zm4 0 .115.006a1.125 1.125 0 0 1 0 2.238L11 8.125h-.998a1.125 1.125 0 1 1 0-2.25H11ZM23.124 14.5c0 1.609-1.05 2.97-2.5 3.444V21a1.125 1.125 0 0 1-2.25 0v-3.056a3.62 3.62 0 0 1-2.5-3.444v-4a3.625 3.625 0 0 1 7.25 0z"
      />
      <path
        fill={color}
        d="M12.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.035 0-1.875.84-1.875 1.875v13.875h8.75zm2.25 13.875H22l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H2a1.125 1.125 0 0 1-.125-2.244V6A4.125 4.125 0 0 1 6 1.875h5A4.125 4.125 0 0 1 15.125 6z"
      />
    </svg>
  );
}
