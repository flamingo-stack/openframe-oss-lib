import type { SVGProps } from "react";
export interface XLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function XLogoIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: XLogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="M9.753 12.656a1.125 1.125 0 1 1 1.59 1.591l-7.548 7.548a1.125 1.125 0 1 1-1.59-1.59zM20.205 2.205a1.125 1.125 0 1 1 1.59 1.59l-7.548 7.549a1.125 1.125 0 0 1-1.59-1.591z" />
      <path d="m8 1.875.134.007c.31.038.593.203.778.459l13 18A1.127 1.127 0 0 1 21 22.125h-5c-.36 0-.7-.173-.912-.466l-13-18A1.127 1.127 0 0 1 3 1.875zm8.575 18h2.223L7.425 4.125H5.202z" />
    </svg>
  );
}
