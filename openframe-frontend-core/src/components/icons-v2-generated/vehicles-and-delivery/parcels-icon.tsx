import type { SVGProps } from "react";
export interface ParcelsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ParcelsIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ParcelsIconProps) {
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
        d="M6.375 15v-3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m9 0v-3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m-4.5-9V3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M10.875 14c0-.423-.3-.776-.699-.857l-.175-.018H5a.875.875 0 0 0-.875.874V19c0 .483.392.875.875.875h5a.875.875 0 0 0 .875-.875zm2.25 5c0 .483.392.875.874.875H19a.875.875 0 0 0 .875-.875v-5a.875.875 0 0 0-.875-.875h-5a.875.875 0 0 0-.875.874zm2.25-14a.875.875 0 0 0-.874-.875H9.5A.875.875 0 0 0 8.625 5v5c0 .483.392.875.875.875h5a.875.875 0 0 0 .875-.874zm2.25 5c0 .304-.045.597-.126.875h1.502a3.125 3.125 0 0 1 3.124 3.124V19A3.125 3.125 0 0 1 19 22.125h-5a3.1 3.1 0 0 1-2-.725 3.1 3.1 0 0 1-2 .725H5A3.125 3.125 0 0 1 1.875 19v-5A3.125 3.125 0 0 1 5 10.874h1.5A3.1 3.1 0 0 1 6.374 10V5A3.125 3.125 0 0 1 9.5 1.875h5A3.125 3.125 0 0 1 17.626 5v5Z"
      />
    </svg>
  );
}
