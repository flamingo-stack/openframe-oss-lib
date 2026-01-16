import type { SVGProps } from "react";
export interface LampIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LampIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LampIconProps) {
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
        d="M10.876 14a1.125 1.125 0 0 1 2.25 0v6.875h2.873l.116.005a1.125 1.125 0 0 1 0 2.239l-.115.006H8a1.125 1.125 0 0 1 0-2.25h2.876zm3.998 2v-2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M15.505.875c1.992 0 3.7 1.424 4.057 3.384l1.527 8.36a2.125 2.125 0 0 1-2.09 2.506H4.996a2.125 2.125 0 0 1-2.09-2.508l1.53-8.36A4.125 4.125 0 0 1 8.496.875zm-7.01 2.25c-.849 0-1.585.569-1.807 1.374l-.037.163-1.504 8.213h13.702l-1.5-8.212a1.875 1.875 0 0 0-1.844-1.538z"
      />
    </svg>
  );
}
