import type { SVGProps } from "react";
export interface VialIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VialIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: VialIconProps) {
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
        d="M13.64 15.133a1.375 1.375 0 1 1-1.508 1.507l-.008-.14.008-.141a1.375 1.375 0 0 1 1.368-1.234zm-3-3a1.375 1.375 0 1 1-1.508 1.507l-.007-.14.007-.141a1.375 1.375 0 0 1 1.368-1.233zm5.86-3.258a1.125 1.125 0 0 1 0 2.25h-9a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M15.375 4.125h-6.75V16.5a3.375 3.375 0 1 0 6.75 0zm2.25 12.375a5.625 5.625 0 0 1-11.25 0V4.125H6a1.125 1.125 0 0 1 0-2.25h12a1.125 1.125 0 0 1 0 2.25h-.375z"
      />
    </svg>
  );
}
