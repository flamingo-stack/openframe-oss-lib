import type { SVGProps } from "react";
export interface Watch02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Watch02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Watch02IconProps) {
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
        d="m15 20.875.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006H9a1.125 1.125 0 0 1 0-2.25zM10.875 8.5a1.126 1.126 0 0 1 2.25 0v3.035l1.67 1.67.078.085a1.125 1.125 0 0 1-1.582 1.583l-.087-.078-2-2a1.12 1.12 0 0 1-.329-.794zM20 6.875c.62 0 1.125.504 1.125 1.125v2c0 .62-.504 1.124-1.125 1.124h-1A1.121 1.121 0 0 1 18.493 9a1.12 1.12 0 0 1-.616-1c0-.621.503-1.125 1.124-1.125zm-5-6a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M17.875 8c0-1.036-.84-1.875-1.876-1.875H8c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.875 1.875 1.875h8c1.035 0 1.875-.84 1.875-1.876zm2.25 8a4.125 4.125 0 0 1-4.126 4.125H8a4.125 4.125 0 0 1-4.125-4.126V8A4.125 4.125 0 0 1 8 3.875h8A4.125 4.125 0 0 1 20.124 8v8Z"
      />
    </svg>
  );
}
