import type { SVGProps } from "react";
export interface FolderOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderOffIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FolderOffIconProps) {
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
        d="M20.875 16.35V9c0-1.035-.84-1.875-1.875-1.875h-5.586c-.493 0-.969-.172-1.347-.482l-.155-.14-2.377-2.378H8.65a1.125 1.125 0 1 1 0-2.25h.936c.493 0 .968.172 1.346.482l.157.14 2.377 2.378H19A4.125 4.125 0 0 1 23.125 9v7.35a1.126 1.126 0 0 1-2.25 0M1.205 1.205a1.125 1.125 0 0 1 1.506-.078l.084.078 20 19.999.078.087a1.124 1.124 0 0 1-1.582 1.581l-.087-.077-.887-.888c-.415.14-.858.218-1.317.218H5A4.125 4.125 0 0 1 .875 18V6c0-.989.35-1.896.93-2.606l-.6-.599-.078-.085a1.125 1.125 0 0 1 .078-1.505M3.125 18c0 1.036.84 1.875 1.875 1.875h13.285L3.414 5.005A1.86 1.86 0 0 0 3.125 6z"
      />
    </svg>
  );
}
