import type { SVGProps } from "react";
export interface CarouselVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CarouselVrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CarouselVrIconProps) {
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
        d="M18.875 9.5A.876.876 0 0 0 18 8.625H6a.875.875 0 0 0-.875.875v5c0 .483.392.875.875.875h12a.876.876 0 0 0 .875-.874zm2.25 5c0 1.726-1.4 3.125-3.125 3.125H6a3.125 3.125 0 0 1-3.125-3.124V9.5A3.125 3.125 0 0 1 6 6.375h12A3.126 3.126 0 0 1 21.125 9.5zM7.591 22.273a1.124 1.124 0 0 1-2.182-.546zm7.456-3.398a3.626 3.626 0 0 1 3.517 2.745l.027.107a1.124 1.124 0 1 1-2.183.546l-.026-.107a1.376 1.376 0 0 0-1.335-1.041H8.952c-.552 0-1.042.328-1.258.82l-.076.221-.027.107L6.5 22l-1.091-.273.026-.107.088-.296a3.625 3.625 0 0 1 3.43-2.449zm1.361-17.147a1.124 1.124 0 1 1 2.183.545l-.027.106a3.625 3.625 0 0 1-3.517 2.746H8.952a3.625 3.625 0 0 1-3.429-2.45l-.088-.296-.026-.107-.022-.112a1.125 1.125 0 0 1 2.17-.542l.034.11.027.105.076.221c.216.492.706.82 1.258.82h6.095c.631 0 1.182-.429 1.335-1.041z"
      />
    </svg>
  );
}
