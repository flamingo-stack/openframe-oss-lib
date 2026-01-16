import type { SVGProps } from "react";
export interface PoundCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PoundCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PoundCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M8.175 9.777V9.75a3.875 3.875 0 0 1 7.199-1.993l.127.23.049.106a1.126 1.126 0 0 1-1.994 1.02l-.057-.1-.115-.19a1.625 1.625 0 0 0-2.959.927v.027c0 .463.068.836.16 1.218l.095.38h2.62l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.006h-2.377c-.004.64-.046 1.388-.33 2.25H14.8l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.005h-6a1.125 1.125 0 0 1-.94-1.741c.718-1.098.804-1.904.812-2.758H8.3a1.125 1.125 0 0 1 0-2.25h.066a7 7 0 0 1-.19-1.599Z"
      />
    </svg>
  );
}
