import type { SVGProps } from "react";
export interface NewspaperIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function NewspaperIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: NewspaperIconProps) {
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
        d="M.875 19V5A4.125 4.125 0 0 1 5 .875h10a4.12 4.12 0 0 1 4.12 4H20A3.124 3.124 0 0 1 23.125 8v11A4.125 4.125 0 0 1 19 23.125H5A4.125 4.125 0 0 1 .875 19m2.25 0c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875V8A.874.874 0 0 0 20 7.125h-.875V18a1.126 1.126 0 0 1-2.25 0V5c0-1.035-.84-1.875-1.874-1.875H5c-1.036 0-1.875.84-1.875 1.875z"
      />
      <path
        fill={color}
        d="m14 16.875.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H6a1.125 1.125 0 0 1 0-2.25zm0-4 .115.005a1.125 1.125 0 0 1 0 2.239l-.116.005H6a1.125 1.125 0 0 1 0-2.25zm-6.875-4h5.75v-1.75h-5.75zm8 .625c0 .897-.727 1.626-1.625 1.626h-7A1.626 1.626 0 0 1 4.875 9.5v-3c0-.898.727-1.625 1.625-1.625h7c.897 0 1.624.727 1.624 1.625z"
      />
    </svg>
  );
}
