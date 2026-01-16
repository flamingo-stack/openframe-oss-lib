import type { SVGProps } from "react";
export interface KeyholeCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function KeyholeCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: KeyholeCircleIconProps) {
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
        d="M12.876 10a.876.876 0 1 0-1.752.002.876.876 0 0 0 1.752-.002m2.25 0a3.12 3.12 0 0 1-2.002 2.913V16a1.125 1.125 0 0 1-2.25 0v-3.087A3.123 3.123 0 0 1 12 6.875 3.126 3.126 0 0 1 15.127 10Z"
      />
    </svg>
  );
}
