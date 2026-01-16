import type { SVGProps } from "react";
export interface FolderInfoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderInfoIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FolderInfoIconProps) {
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
        d="M.875 18V6A4.125 4.125 0 0 1 5 1.875h4.586c.493 0 .969.172 1.347.482l.155.14 2.377 2.378H19A4.125 4.125 0 0 1 23.125 9v9A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18m2.25 0c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875V9c0-1.036-.84-1.875-1.875-1.875h-5.586c-.493 0-.968-.172-1.346-.482l-.157-.14-2.377-2.378H5c-1.036 0-1.875.84-1.875 1.875z"
      />
      <path
        fill={color}
        d="M12.01 11.875c.62 0 1.124.504 1.124 1.125v3.384a1.124 1.124 0 0 1-.019 2.235l-.116.006H11a1.125 1.125 0 0 1-.116-2.244v-2.442a1.122 1.122 0 0 1 .615-2.064zM13.373 9.5a1.374 1.374 0 0 1-2.742.141l-.007-.14.007-.141A1.375 1.375 0 0 1 12 8.125l.14.007A1.375 1.375 0 0 1 13.373 9.5"
      />
    </svg>
  );
}
