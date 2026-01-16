import type { SVGProps } from "react";
export interface TwitterXIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TwitterXIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TwitterXIconProps) {
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
        d="M9.753 12.656a1.125 1.125 0 1 1 1.59 1.591l-7.548 7.548a1.125 1.125 0 1 1-1.59-1.59zM20.204 2.205a1.125 1.125 0 1 1 1.591 1.59l-7.548 7.549a1.125 1.125 0 1 1-1.59-1.591z"
      />
      <path
        fill={color}
        d="m8 1.875.134.007c.31.038.593.203.778.459l13 18A1.127 1.127 0 0 1 21 22.125h-5c-.36 0-.7-.173-.912-.466l-13-18A1.127 1.127 0 0 1 3 1.875zm8.575 18h2.223L7.425 4.125H5.202z"
      />
    </svg>
  );
}
