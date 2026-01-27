import type { SVGProps } from "react";
export interface AlphabetDCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetDCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetDCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M13.375 10.5c0-.759-.616-1.375-1.376-1.375h-.874v5.75h.874c.76 0 1.376-.615 1.376-1.374zm2.25 3a3.625 3.625 0 0 1-3.626 3.625h-1.748c-.76 0-1.376-.615-1.376-1.374v-7.5c0-.76.616-1.376 1.376-1.376h1.748a3.626 3.626 0 0 1 3.626 3.626z"
      />
    </svg>
  );
}
