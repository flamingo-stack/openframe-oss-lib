import type { SVGProps } from "react";
export interface LaptopMobileIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LaptopMobileIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LaptopMobileIconProps) {
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
        d="M1.876 6A4.125 4.125 0 0 1 6 1.875h10a4.13 4.13 0 0 1 3.773 2.455l.117.295.033.11a1.124 1.124 0 0 1-2.11.746l-.044-.106-.117-.263A1.88 1.88 0 0 0 16 4.125H6c-1.035 0-1.874.84-1.874 1.875v7.875H8l.221.022c.216.043.417.15.575.308l.67.67H11l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H3.118a2.13 2.13 0 0 1-1.75-.918l-.15-.256-.224-.449a1.125 1.125 0 0 1 .882-1.62z"
      />
      <path
        fill={color}
        d="M20.875 11a.875.875 0 0 0-.875-.875h-3a.875.875 0 0 0-.874.874V19c0 .483.391.875.874.875h3a.875.875 0 0 0 .875-.875zM8 13.874l.221.022c.216.043.417.15.575.308l.67.67H11l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H3.118c-.805 0-1.54-.455-1.9-1.174l-.224-.449A1.125 1.125 0 0 1 2 13.875zM23.125 19A3.125 3.125 0 0 1 20 22.125h-3A3.125 3.125 0 0 1 13.876 19v-8A3.125 3.125 0 0 1 17 7.874h3a3.125 3.125 0 0 1 3.125 3.124z"
      />
    </svg>
  );
}
