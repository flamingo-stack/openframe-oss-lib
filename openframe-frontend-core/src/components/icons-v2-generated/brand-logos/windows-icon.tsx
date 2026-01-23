import type { SVGProps } from "react";
export interface WindowsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WindowsIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WindowsIconProps) {
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
        d="M9.875 20v-6.876H2a1.125 1.125 0 0 1 0-2.25h7.875V4a1.125 1.125 0 0 1 2.25 0v6.874H22l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005h-9.875V20a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 5.998a1.875 1.875 0 0 0-2.097-1.862l-14 1.667a1.875 1.875 0 0 0-1.653 1.862v8.67c0 .95.71 1.75 1.654 1.862l14 1.667.207.013a1.875 1.875 0 0 0 1.889-1.875zm2.25 12.004a4.124 4.124 0 0 1-4.383 4.116l-.229-.02-14-1.666a4.126 4.126 0 0 1-3.638-4.097v-8.67c0-2.09 1.562-3.85 3.637-4.097l14.001-1.666a4.125 4.125 0 0 1 4.611 4.096z"
      />
    </svg>
  );
}
