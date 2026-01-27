import type { SVGProps } from "react";
export interface SimCardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SimCardIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SimCardIconProps) {
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
        d="M2.875 19V5A4.125 4.125 0 0 1 7 .875h5.757a4.13 4.13 0 0 1 2.918 1.208l4.242 4.243a4.13 4.13 0 0 1 1.208 2.916V19A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19m2.25 0c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875V9.242c0-.497-.197-.974-.549-1.326l-4.244-4.242a1.88 1.88 0 0 0-1.325-.549H7c-1.036 0-1.875.84-1.875 1.875z"
      />
      <path
        fill={color}
        d="M13.125 17.375h2.25v-2.25h-2.25zm-4.5 0h2.25v-6.75h-2.25zm4.5-4.5h2.25v-2.25h-2.25zm4.5 4.625a2.126 2.126 0 0 1-2.126 2.125H8.5A2.126 2.126 0 0 1 6.375 17.5v-7c0-1.173.952-2.125 2.125-2.125h7c1.173 0 2.125.952 2.125 2.126z"
      />
    </svg>
  );
}
