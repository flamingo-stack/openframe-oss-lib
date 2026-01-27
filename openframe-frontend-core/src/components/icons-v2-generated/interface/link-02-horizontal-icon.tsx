import type { SVGProps } from "react";
export interface Link02HorizontalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Link02HorizontalIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Link02HorizontalIconProps) {
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
        d="M8.375 12v-.5a1.125 1.125 0 0 1 2.25 0v.5l.02.396a3.876 3.876 0 0 0 3.855 3.48H17l.396-.021a3.876 3.876 0 0 0 3.459-3.459l.02-.397A3.875 3.875 0 0 0 17 8.125h-.5a1.125 1.125 0 0 1 0-2.25h.5l.315.007A6.126 6.126 0 0 1 17 18.125h-2.5a6.126 6.126 0 0 1-6.117-5.81z"
      />
      <path
        fill={color}
        d="M13.374 12.5V12A3.875 3.875 0 0 0 9.5 8.124H7a3.875 3.875 0 0 0 0 7.75h.5l.115.006a1.126 1.126 0 0 1 0 2.239l-.115.005H7a6.126 6.126 0 0 1 0-12.25h2.5a6.125 6.125 0 0 1 6.124 6.124v.502a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
