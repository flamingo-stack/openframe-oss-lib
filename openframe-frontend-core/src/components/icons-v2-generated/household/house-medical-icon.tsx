import type { SVGProps } from "react";
export interface HouseMedicalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HouseMedicalIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HouseMedicalIconProps) {
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
        d="M2.875 18V8.44a1.125 1.125 0 0 1 2.25 0V18c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.876-.84 1.876-1.875V8.44a1.125 1.125 0 1 1 2.25 0V18A4.125 4.125 0 0 1 17 22.125H7A4.125 4.125 0 0 1 2.874 18Z"
      />
      <path
        fill={color}
        d="M11.626 11.5c0 .622-.505 1.126-1.125 1.126H9.125v.75h1.376c.62 0 1.125.504 1.125 1.125v1.374h.75V14.5c0-.621.503-1.125 1.125-1.125h1.374v-.75H13.5a1.126 1.126 0 0 1-1.125-1.125v-1.376h-.75zM9.749 2.549a4.13 4.13 0 0 1 4.789.205l8.155 6.36a1.126 1.126 0 0 1-1.385 1.774l-8.155-6.36a1.88 1.88 0 0 0-2.176-.094l-.13.094-8.155 6.36-.094.066a1.126 1.126 0 0 1-1.29-1.84l8.156-6.36zm4.877 7.828h.874c.898 0 1.625.727 1.625 1.624v2c0 .897-.727 1.626-1.625 1.626h-.874v.874c0 .898-.729 1.625-1.626 1.625h-2A1.624 1.624 0 0 1 9.376 16.5v-.874H8.5A1.626 1.626 0 0 1 6.875 14v-2c0-.897.727-1.624 1.625-1.624h.876V9.5c0-.898.727-1.625 1.624-1.625h2c.897 0 1.626.727 1.626 1.625v.876Z"
      />
    </svg>
  );
}
