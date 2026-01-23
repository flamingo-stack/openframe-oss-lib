import type { SVGProps } from "react";
export interface ChefHatIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChefHatIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChefHatIconProps) {
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
        d="M14.58 10.878c.62.044 1.087.583 1.043 1.203l-.343 4.794H18a1.125 1.125 0 0 1 0 2.25H6a1.125 1.125 0 0 1 0-2.25h2.72l-.343-4.794-.001-.116a1.125 1.125 0 0 1 2.232-.16l.014.114.354 4.956h2.048l.354-4.956a1.125 1.125 0 0 1 1.202-1.041"
      />
      <path
        fill={color}
        d="M20.875 9a2.875 2.875 0 0 0-4.33-2.481 1.126 1.126 0 0 1-1.688-.844 2.876 2.876 0 0 0-5.714 0 1.125 1.125 0 0 1-1.688.844A2.876 2.876 0 1 0 6 11.874c.621 0 1.125.505 1.125 1.125V20c0 .483.392.875.875.875h8a.875.875 0 0 0 .875-.875v-7c0-.622.504-1.126 1.125-1.126A2.874 2.874 0 0 0 20.875 9m2.25 0a5.124 5.124 0 0 1-4 4.998V20c0 1.726-1.4 3.125-3.126 3.125H8A3.124 3.124 0 0 1 4.875 20v-6.002a5.124 5.124 0 1 1 2.39-9.963 5.127 5.127 0 0 1 9.468 0A5.125 5.125 0 0 1 23.124 9Z"
      />
    </svg>
  );
}
