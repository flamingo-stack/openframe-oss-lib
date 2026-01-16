import type { SVGProps } from "react";
export interface FastBackwardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FastBackwardIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FastBackwardIconProps) {
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
        d="M18.875 20V4a1.125 1.125 0 1 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0m-4-14.496a.376.376 0 0 0-.492-.357l-.096.048-8.784 6.085a.875.875 0 0 0 0 1.439l8.784 6.085a.375.375 0 0 0 .588-.308zm2.25 12.992c0 2.118-2.38 3.364-4.12 2.158l-8.783-6.085c-1.794-1.243-1.793-3.895 0-5.137l8.783-6.085.165-.107c1.723-1.021 3.955.213 3.955 2.264z"
      />
    </svg>
  );
}
