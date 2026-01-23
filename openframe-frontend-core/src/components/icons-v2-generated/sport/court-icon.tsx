import type { SVGProps } from "react";
export interface CourtIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CourtIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CourtIconProps) {
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
        d="M13.374 12a1.374 1.374 0 1 0-2.748 0 1.374 1.374 0 0 0 2.748 0M22 7.874l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.005h-2.875v3.75H22l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.006h-3A2.124 2.124 0 0 1 16.875 14v-4c0-1.173.951-2.125 2.125-2.125h3Zm-6.376 4.124a3.625 3.625 0 0 1-2.498 3.446V20a1.126 1.126 0 0 1-2.25 0v-4.555a3.625 3.625 0 0 1 0-6.89V4a1.125 1.125 0 0 1 2.25 0v4.554A3.625 3.625 0 0 1 15.623 12ZM7.125 14A2.125 2.125 0 0 1 5 16.125H2a1.125 1.125 0 0 1 0-2.25h2.875v-3.75H2a1.125 1.125 0 1 1 0-2.25h3c1.174 0 2.125.951 2.125 2.125z"
      />
      <path
        fill={color}
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
    </svg>
  );
}
