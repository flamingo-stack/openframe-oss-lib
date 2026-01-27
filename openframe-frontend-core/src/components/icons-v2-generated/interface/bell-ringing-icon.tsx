import type { SVGProps } from "react";
export interface BellRingingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BellRingingIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BellRingingIconProps) {
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
        d="M17.874 9.5a5.875 5.875 0 1 0-11.75 0v3.632c0 .94-.32 1.847-.901 2.575l-.266.3-.224.232a.374.374 0 0 0 .268.636h13.997c.29 0 .456-.305.338-.541l-.069-.095-.224-.232a4.13 4.13 0 0 1-1.169-2.875zm2.25 3.632c0 .488.192.957.532 1.306l.224.232c1.619 1.664.439 4.455-1.882 4.455H5c-2.32 0-3.5-2.791-1.882-4.455l.226-.232.12-.136c.264-.33.41-.743.41-1.17V9.5a8.126 8.126 0 0 1 16.25 0zM14 20.875l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006h-4a1.125 1.125 0 0 1 0-2.25zM3.705 1.204a1.125 1.125 0 0 1 1.59 1.59c-.927.928-1.788 2.05-2.215 3.519l-.037.108A1.125 1.125 0 0 1 .92 5.686l.113-.364C1.634 3.537 2.7 2.21 3.705 1.205Zm15 0a1.125 1.125 0 0 1 1.506-.078l.085.078.404.419c.877.947 1.745 2.151 2.266 3.698l.114.364.027.112a1.125 1.125 0 0 1-2.149.624l-.038-.108-.085-.271c-.39-1.16-1.05-2.095-1.786-2.89l-.344-.358-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
