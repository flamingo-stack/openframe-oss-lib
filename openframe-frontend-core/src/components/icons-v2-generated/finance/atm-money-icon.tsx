import type { SVGProps } from "react";
export interface AtmMoneyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AtmMoneyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AtmMoneyIconProps) {
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
        d="M17.375 8.125H6.625V18c0 1.035.84 1.875 1.875 1.875h7c1.036 0 1.875-.84 1.875-1.875zm-4.874 8.75.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H11.5a1.125 1.125 0 0 1 0-2.25zm.874-4.374a1.376 1.376 0 1 0-2.752 0 1.376 1.376 0 0 0 2.752 0M19.625 18a4.125 4.125 0 0 1-4.124 4.125H8.5A4.125 4.125 0 0 1 4.375 18V7c0-.621.504-1.125 1.125-1.125h13A1.126 1.126 0 0 1 19.625 7zm-4-5.5a3.625 3.625 0 1 1-7.248 0 3.625 3.625 0 0 1 7.248 0"
      />
    </svg>
  );
}
