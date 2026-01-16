import type { SVGProps } from "react";
export interface Dispenser02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Dispenser02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Dispenser02IconProps) {
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
        d="m17.5 13.876.115.005a1.125 1.125 0 0 1 0 2.239l-.115.005h-11a1.125 1.125 0 0 1 0-2.25zM13.876 8V4a.876.876 0 0 0-.877-.875h-2.873V8a1.125 1.125 0 0 1-2.25 0V4.125H7A1.125 1.125 0 0 1 5.875 3V2l.005-.116A1.126 1.126 0 0 1 7 .875h6A3.126 3.126 0 0 1 16.124 4v4a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M16.375 12A2.875 2.875 0 0 0 13.5 9.125h-3A2.876 2.876 0 0 0 7.625 12v7c0 1.035.84 1.874 1.875 1.874h5c1.035 0 1.875-.84 1.875-1.875zm2.25 7a4.125 4.125 0 0 1-4.126 4.124H9.5A4.125 4.125 0 0 1 5.375 19v-7a5.126 5.126 0 0 1 5.126-5.125h3A5.125 5.125 0 0 1 18.625 12z"
      />
    </svg>
  );
}
