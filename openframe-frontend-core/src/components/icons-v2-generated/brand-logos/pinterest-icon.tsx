import type { SVGProps } from "react";
export interface PinterestIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PinterestIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PinterestIconProps) {
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
        d="M10.997 10.49a1.125 1.125 0 0 1 2.052.914l-1.882 4.89A4.374 4.374 0 1 0 7.625 12c0 .422.06.828.17 1.212l.164.487a1.125 1.125 0 0 1-2.084.814l-.047-.105-.104-.283a6.626 6.626 0 1 1 6.276 4.5c-.569 0-1.12-.075-1.649-.21l-1.226 3.19a1.125 1.125 0 0 1-2.1-.808l3.924-10.201z"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
