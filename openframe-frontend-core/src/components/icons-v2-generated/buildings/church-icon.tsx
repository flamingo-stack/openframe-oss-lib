import type { SVGProps } from "react";
export interface ChurchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChurchIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ChurchIconProps) {
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
        d="M19.875 21v-5.84a.88.88 0 0 0-.44-.759l-.81-.463V21a1.126 1.126 0 0 1-2.25 0v-9.98a.88.88 0 0 0-.28-.642l-.08-.066L12 7.392l-4.015 2.92a.88.88 0 0 0-.36.708V21a1.125 1.125 0 0 1-2.25 0v-7.062l-.81.463a.88.88 0 0 0-.44.76V21a1.125 1.125 0 0 1-2.25 0v-5.84c0-1.122.601-2.157 1.575-2.714l1.925-1.1v-.328c0-1 .479-1.94 1.287-2.528l4.213-3.065v-.301h-.874a1.125 1.125 0 1 1 0-2.25h.874V2a1.125 1.125 0 0 1 2.25 0v.875h.874a1.125 1.125 0 0 1 0 2.25h-.874v.301l4.213 3.065.287.237c.633.587 1 1.416 1 2.291v.328l1.925 1.1.179.11a3.13 3.13 0 0 1 1.396 2.603V21a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M12.875 17a.875.875 0 0 0-1.75 0v2.875h1.75zm2.25 2.875H22l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H2a1.125 1.125 0 0 1 0-2.25h6.875V17a3.126 3.126 0 0 1 6.25 0z"
      />
    </svg>
  );
}
