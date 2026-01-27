import type { SVGProps } from "react";
export interface StandardHdIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StandardHdIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StandardHdIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M9.125 16v-3.376h-2.25V16a1.125 1.125 0 0 1-2.25 0V8a1.125 1.125 0 0 1 2.25 0v2.374h2.25V8a1.125 1.125 0 0 1 2.25 0v8a1.125 1.125 0 0 1-2.25 0m8.25-5.5c0-.759-.616-1.375-1.376-1.375h-.874v5.75h.874c.76 0 1.376-.615 1.376-1.374zm2.25 3a3.625 3.625 0 0 1-3.626 3.625h-1.748c-.76 0-1.376-.615-1.376-1.374v-7.5c0-.76.616-1.376 1.376-1.376h1.748a3.626 3.626 0 0 1 3.626 3.626z"
      />
    </svg>
  );
}
