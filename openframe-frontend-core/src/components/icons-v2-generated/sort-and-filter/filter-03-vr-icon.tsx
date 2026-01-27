import type { SVGProps } from "react";
export interface Filter03VrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Filter03VrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Filter03VrIconProps) {
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
        d="M3.875 20v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m7 0V10a1.125 1.125 0 0 1 2.25 0v10a1.126 1.126 0 0 1-2.25 0m7 0v-2a1.126 1.126 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m0-6V4a1.125 1.125 0 0 1 2.25 0v10a1.125 1.125 0 0 1-2.25 0m-14-2V4a1.125 1.125 0 0 1 2.25 0v8a1.125 1.125 0 0 1-2.25 0m7-6V4a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="m21 12.876.116.005a1.125 1.125 0 0 1 0 2.239l-.116.006h-4a1.126 1.126 0 0 1 0-2.25zM7 10.873l.115.006a1.126 1.126 0 0 1 0 2.239L7 13.124H3a1.125 1.125 0 0 1 0-2.25h4Zm7-1.999.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-3.998a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
