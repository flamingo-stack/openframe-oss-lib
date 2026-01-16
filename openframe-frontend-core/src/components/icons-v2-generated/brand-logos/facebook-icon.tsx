import type { SVGProps } from "react";
export interface FacebookIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FacebookIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FacebookIconProps) {
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
        d="M9.625 10.75c0 .62-.504 1.124-1.125 1.124H6.125v1.751H8.5c.62 0 1.125.504 1.125 1.125v6.125h2.75V14.75c0-.621.504-1.125 1.126-1.125h2.622l.438-1.75H13.5a1.125 1.125 0 0 1-1.125-1.126v-3c0-1.173.95-2.123 2.123-2.124h3.376v-2.5h-3.376A4.875 4.875 0 0 0 9.625 8zm10.5-4.5c0 .897-.727 1.625-1.625 1.625h-3.874v1.75h2.733c.991 0 1.735.873 1.613 1.828l-.036.192-.75 3a1.626 1.626 0 0 1-1.577 1.23h-1.984V21.5c0 .898-.728 1.625-1.626 1.625H9A1.625 1.625 0 0 1 7.375 21.5v-5.625H5.5a1.625 1.625 0 0 1-1.625-1.624v-3c0-.898.727-1.626 1.625-1.626h1.875V8A7.125 7.125 0 0 1 14.499.875H18.5c.897 0 1.624.727 1.625 1.625z"
      />
    </svg>
  );
}
