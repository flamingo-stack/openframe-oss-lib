import type { SVGProps } from "react";
export interface MoonStarIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MoonStarIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MoonStarIconProps) {
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
        d="M18.875 12v-.874H18a1.125 1.125 0 0 1 0-2.25h.875v-.877a1.126 1.126 0 0 1 2.25 0v.876H22l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.006h-.877V12a1.125 1.125 0 0 1-2.25 0Zm-1.5-6.5a1.374 1.374 0 0 1-2.743.141l-.007-.14.007-.141A1.375 1.375 0 0 1 16 4.125l.141.007A1.376 1.376 0 0 1 17.375 5.5"
      />
      <path
        fill={color}
        d="M9.375 6.696c0-1.157.182-2.273.519-3.32a8.875 8.875 0 1 0 9.11 14.073c-5.415-.593-9.629-5.18-9.629-10.753m2.25 0a8.57 8.57 0 0 0 9.285 8.541 1.127 1.127 0 0 1 1.104 1.613 11.13 11.13 0 0 1-10.013 6.274C5.856 23.124.875 18.144.875 12 .875 5.964 5.682 1.05 11.677.88a1.126 1.126 0 0 1 1.016 1.669 8.5 8.5 0 0 0-1.067 4.147Z"
      />
    </svg>
  );
}
