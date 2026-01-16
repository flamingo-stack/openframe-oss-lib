import type { SVGProps } from "react";
export interface AtmCardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AtmCardIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AtmCardIconProps) {
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
        d="M20.875 10V6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v4c0 1.036.84 1.876 1.875 1.876h.5l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006H5A4.125 4.125 0 0 1 .875 10V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6v4A4.125 4.125 0 0 1 19 14.127h-.5a1.125 1.125 0 0 1 0-2.25h.5c1.035 0 1.874-.84 1.875-1.875Z"
      />
      <path
        fill={color}
        d="M17.375 8.125h-6.75v11.75h4.876c1.035 0 1.874-.84 1.874-1.875zm-4 8.875v-1.5a1.125 1.125 0 0 1 2.25 0V17a1.125 1.125 0 0 1-2.25 0m-6.75 1c0 .993.773 1.805 1.75 1.869V8.125h-1.75zm13 0a4.125 4.125 0 0 1-4.124 4.125H8.5A4.125 4.125 0 0 1 4.375 18V7c0-.621.504-1.125 1.125-1.125h13A1.126 1.126 0 0 1 19.625 7z"
      />
    </svg>
  );
}
