import type { SVGProps } from "react";
export interface BriefcaseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BriefcaseIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BriefcaseIconProps) {
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
        d="M4.875 22V6a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0m12 0V6a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 9c0-1.035-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zm-6-5A.875.875 0 0 0 14 3.125h-4A.875.875 0 0 0 9.125 4v.875h5.75zm2.25.875H19A4.125 4.125 0 0 1 23.125 9v10A4.125 4.125 0 0 1 19 23.125H5A4.125 4.125 0 0 1 .875 19V9A4.125 4.125 0 0 1 5 4.875h1.875V4A3.125 3.125 0 0 1 10 .875h4A3.125 3.125 0 0 1 17.125 4z"
      />
    </svg>
  );
}
