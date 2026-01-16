import type { SVGProps } from "react";
export interface CloudWeatherSnow02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CloudWeatherSnow02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CloudWeatherSnow02IconProps) {
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
        d="M17.862 15.053a1.126 1.126 0 0 1-.376-2.219l.376 2.22ZM19.875 10a2.88 2.88 0 0 0-2.158-2.785 1.125 1.125 0 0 1-.843-1.135l.001-.08a1.875 1.875 0 0 0-3.003-1.498 1.125 1.125 0 0 1-1.538-.173 3.375 3.375 0 0 0-5.918 2.704c.084.532-.22 1.05-.727 1.234a2.377 2.377 0 0 0 .661 4.604 1.125 1.125 0 1 1-.14 2.245 4.625 4.625 0 0 1-2.085-8.584V6.5a5.625 5.625 0 0 1 9.256-4.295 4.12 4.12 0 0 1 5.68 3.101 5.126 5.126 0 0 1-1.199 9.747l-.187-1.11-.19-1.109A2.88 2.88 0 0 0 19.876 10Z"
      />
      <path
        fill={color}
        d="M10.876 21v-1.053l-.912.527a1.125 1.125 0 1 1-1.125-1.948L9.75 18l-.91-.526-.096-.063a1.125 1.125 0 0 1 1.119-1.938l.102.053.912.526V15a1.125 1.125 0 0 1 2.25 0v1.05l.91-.524a1.125 1.125 0 0 1 1.124 1.948L14.25 18l.911.526.097.063a1.124 1.124 0 0 1-1.12 1.938l-.102-.053-.91-.526V21a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
