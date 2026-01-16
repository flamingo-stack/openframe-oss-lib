import type { SVGProps } from "react";
export interface ShovelIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShovelIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ShovelIconProps) {
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
        d="M17.14 1.24a1.625 1.625 0 0 1 2.05 0l.123.112 3.336 3.334.111.123a1.63 1.63 0 0 1 0 2.052l-.111.123-1.669 1.667a3.98 3.98 0 0 1-4.72.679l-4.365 4.365a1.125 1.125 0 1 1-1.59-1.591l4.364-4.365a3.98 3.98 0 0 1 .68-4.72l1.668-1.667.123-.111Zm-.2 3.37a1.733 1.733 0 0 0 0 2.45l.13.12a1.735 1.735 0 0 0 2.32-.12l1.224-1.226-2.449-2.449z"
      />
      <path
        fill={color}
        d="M5.71 8.631a2.126 2.126 0 0 1 2.683 0l.16.147 6.669 6.668c.83.83.83 2.176 0 3.006l-2.587 2.586a7.13 7.13 0 0 1-5.038 2.086H5A4.125 4.125 0 0 1 .875 19v-2.597c0-1.89.751-3.701 2.087-5.037L5.55 8.778zM3.125 19c0 1.036.84 1.875 1.875 1.875h2.597a4.88 4.88 0 0 0 3.447-1.426l2.499-2.5-6.492-6.492-2.498 2.5a4.88 4.88 0 0 0-1.428 3.446z"
      />
    </svg>
  );
}
