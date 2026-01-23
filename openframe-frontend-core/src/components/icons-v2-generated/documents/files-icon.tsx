import type { SVGProps } from "react";
export interface FilesIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FilesIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FilesIconProps) {
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
        d="M1.875 15V6a1.125 1.125 0 0 1 2.25 0v9a5.876 5.876 0 0 0 5.876 5.875h9l.114.006a1.126 1.126 0 0 1 0 2.239l-.114.005h-9A8.126 8.126 0 0 1 1.875 15"
      />
      <path
        fill={color}
        d="M5.875 15V5A4.125 4.125 0 0 1 10 .875h4.586c.493 0 .969.172 1.347.482l.155.14 4.415 4.414.14.157c.31.378.482.853.482 1.346v7.587A4.126 4.126 0 0 1 17 19.125h-7a4.125 4.125 0 0 1-4.125-4.124Zm10.25-9.5c0 .206.168.374.375.375h.785l-1.16-1.16zm-8 9.5c0 1.036.84 1.875 1.875 1.875h7c1.036 0 1.875-.84 1.875-1.874V8.125H16.5A2.625 2.625 0 0 1 13.874 5.5V3.125H10c-1.036 0-1.875.84-1.875 1.875z"
      />
    </svg>
  );
}
