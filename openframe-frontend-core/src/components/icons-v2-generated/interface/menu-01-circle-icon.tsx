import type { SVGProps } from "react";
export interface Menu01CircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Menu01CircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Menu01CircleIconProps) {
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
        d="m16.5 14.874.116.006a1.126 1.126 0 0 1 0 2.239l-.116.006h-9a1.125 1.125 0 0 1 0-2.25zm0-3.998.116.005a1.125 1.125 0 0 1 0 2.239l-.116.006h-9a1.125 1.125 0 0 1 0-2.25zm0-4.001a1.125 1.125 0 0 1 0 2.25h-9a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
