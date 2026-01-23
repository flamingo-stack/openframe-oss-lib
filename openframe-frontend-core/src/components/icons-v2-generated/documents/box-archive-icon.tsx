import type { SVGProps } from "react";
export interface BoxArchiveIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BoxArchiveIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BoxArchiveIconProps) {
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
        d="M2.375 18V8a1.125 1.125 0 0 1 2.25 0v10c0 1.036.84 1.875 1.875 1.875h11c1.035 0 1.874-.84 1.875-1.875V8a1.125 1.125 0 0 1 2.25 0v10a4.125 4.125 0 0 1-4.125 4.125h-11A4.125 4.125 0 0 1 2.375 18"
      />
      <path
        fill={color}
        d="m14 10.875.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-4a1.125 1.125 0 0 1 0-2.25zm-10.875-4h17.75v-2.75H3.125zm20 .125A2.125 2.125 0 0 1 21 9.125H3A2.125 2.125 0 0 1 .875 7V4c0-1.173.952-2.125 2.125-2.125h18c1.174 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
