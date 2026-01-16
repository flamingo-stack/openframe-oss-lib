import type { SVGProps } from "react";
export interface UmbrellaIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UmbrellaIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: UmbrellaIconProps) {
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
        d="M6.875 20a1.125 1.125 0 0 1 2.25 0 .875.875 0 0 0 1.75 0v-8a1.125 1.125 0 0 1 2.25 0v8a3.125 3.125 0 0 1-6.25 0m4-17V2a1.125 1.125 0 0 1 2.25 0v1a1.126 1.126 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M12 1.875c5.592 0 10.125 4.533 10.125 10.125 0 .621-.504 1.125-1.125 1.125H3A1.125 1.125 0 0 1 1.875 12C1.875 6.408 6.408 1.875 12 1.875m0 2.25a7.875 7.875 0 0 0-7.793 6.75h15.586a7.874 7.874 0 0 0-7.792-6.75Z"
      />
    </svg>
  );
}
