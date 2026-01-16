import type { SVGProps } from "react";
export interface FastForwardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FastForwardIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FastForwardIconProps) {
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
        d="M2.877 20V4a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0m4-14.495c0-2.118 2.38-3.364 4.12-2.158l8.782 6.085c1.794 1.242 1.794 3.894 0 5.137l-8.781 6.085c-1.741 1.206-4.121-.04-4.121-2.158zm2.25 12.991c0 .303.34.48.589.308l8.783-6.085c.47-.326.5-.999.088-1.368l-.088-.07-8.783-6.086a.376.376 0 0 0-.59.31v12.991Z"
      />
    </svg>
  );
}
