import type { SVGProps } from "react";
export interface IceCreamIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function IceCreamIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: IceCreamIconProps) {
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
        d="M16.003 11.479a1.125 1.125 0 0 1 2.042.937l-3.607 9.053c-.85 2.135-3.806 2.202-4.788.2l-.088-.2-3.606-9.053-.039-.108a1.125 1.125 0 0 1 2.08-.83l.047.106 3.608 9.051c.126.315.57.316.696.002l3.607-9.053z"
      />
      <path
        fill={color}
        d="M17.875 10.5a.38.38 0 0 0-.273-.361 1.125 1.125 0 0 1-.803-1.28 4.875 4.875 0 1 0-9.6 0 1.124 1.124 0 0 1-.802 1.28.376.376 0 0 0 .103.737h11a.375.375 0 0 0 .375-.375Zm2.25 0a2.625 2.625 0 0 1-2.625 2.626h-5.375V14a1.125 1.125 0 0 1-2.25 0v-.874H6.5a2.625 2.625 0 0 1-1.61-4.698 7.125 7.125 0 1 1 14.22.001 2.62 2.62 0 0 1 1.015 2.072Z"
      />
    </svg>
  );
}
