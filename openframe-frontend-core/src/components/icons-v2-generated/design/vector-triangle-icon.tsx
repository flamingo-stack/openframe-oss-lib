import type { SVGProps } from "react";
export interface VectorTriangleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VectorTriangleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: VectorTriangleIconProps) {
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
        d="M4.479 17.997c.515.27 1.144.1 1.458-.375l.06-.1 5.5-10.5a1.126 1.126 0 0 0-1.994-1.044l-5.5 10.5-.047.105c-.212.53.007 1.143.523 1.414m10.018-12.02a1.126 1.126 0 0 0-1.994 1.045zm3.565 11.645a1.126 1.126 0 0 0 1.935-1.145l-5.5-10.5-.996.523-.998.522 5.5 10.5zM17 20.125l.116-.006a1.125 1.125 0 0 0 0-2.238L17 17.875H7a1.125 1.125 0 0 0 0 2.25z"
      />
      <path
        fill={color}
        d="M5.875 19a.876.876 0 1 0-1.75 0 .876.876 0 0 0 1.75 0m14 0a.876.876 0 1 0-1.752 0 .876.876 0 0 0 1.752 0m-7-14a.875.875 0 1 0-1.75 0 .875.875 0 0 0 1.75 0m-4.75 14a3.126 3.126 0 1 1-6.251-.002A3.126 3.126 0 0 1 8.125 19m14 0a3.125 3.125 0 1 1-6.25 0 3.125 3.125 0 0 1 6.25 0m-7-14a3.125 3.125 0 1 1-6.251 0 3.125 3.125 0 0 1 6.25 0Z"
      />
    </svg>
  );
}
