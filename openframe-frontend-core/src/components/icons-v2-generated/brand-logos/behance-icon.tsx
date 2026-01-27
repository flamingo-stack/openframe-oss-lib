import type { SVGProps } from "react";
export interface BehanceIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BehanceIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BehanceIconProps) {
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
        d="M18 8.875a5.125 5.125 0 0 1 5.125 5.126c0 .62-.504 1.125-1.125 1.125h-6.87A2.873 2.873 0 0 0 18 17.875a2.93 2.93 0 0 0 2.526-1.439 1.126 1.126 0 0 1 1.948 1.127A5.18 5.18 0 0 1 18 20.125a5.126 5.126 0 0 1-5.125-5.126v-.998A5.126 5.126 0 0 1 18 8.875m0 2.25a2.88 2.88 0 0 0-2.646 1.75h5.292A2.88 2.88 0 0 0 18 11.126Zm1.5-5.25.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-3a1.125 1.125 0 0 1 0-2.25zM9.875 15.5A2.375 2.375 0 0 0 7.5 13.126H3.125v4.749H7.5A2.375 2.375 0 0 0 9.875 15.5m0-7A2.375 2.375 0 0 0 7.5 6.125H3.125v4.75H7.5l.242-.013A2.375 2.375 0 0 0 9.875 8.5m2.25 0a4.61 4.61 0 0 1-1.608 3.499 4.61 4.61 0 0 1 1.608 3.501A4.625 4.625 0 0 1 7.5 20.125H3A2.125 2.125 0 0 1 .875 18V6c0-1.173.952-2.125 2.125-2.125h4.5A4.625 4.625 0 0 1 12.125 8.5"
      />
    </svg>
  );
}
