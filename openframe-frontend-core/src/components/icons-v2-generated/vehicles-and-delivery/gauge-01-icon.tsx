import type { SVGProps } from "react";
export interface Gauge01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Gauge01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Gauge01IconProps) {
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
        d="M10.874 10a1.125 1.125 0 0 1 2.25 0v3.198a2.126 2.126 0 1 1-3.239 2.019L9.876 15l.01-.217a2.12 2.12 0 0 1 .99-1.585v-3.197ZM5 10.876l.115.006a1.125 1.125 0 0 1 0 2.238L5 13.125H2.5a1.125 1.125 0 0 1 0-2.25zm16.5 0 .115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H19a1.125 1.125 0 0 1 0-2.25zM4.205 5.205a1.125 1.125 0 0 1 1.504-.078l.087.078 2.05 2.05.077.085A1.126 1.126 0 0 1 6.34 8.922l-.087-.076-2.049-2.05-.078-.086a1.125 1.125 0 0 1 .078-1.505Zm14 0a1.125 1.125 0 1 1 1.59 1.59l-2.05 2.051a1.125 1.125 0 0 1-1.591-1.59l2.05-2.051ZM10.875 6V3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 13a8.875 8.875 0 1 0-15.526 5.875H18.65A8.84 8.84 0 0 0 20.875 13m2.25 0c0 2.864-1.083 5.477-2.86 7.448-.41.454-.982.677-1.544.677H5.278a2.07 2.07 0 0 1-1.542-.677A11.1 11.1 0 0 1 .875 13c0-6.145 4.98-11.126 11.124-11.126S23.125 6.855 23.125 13"
      />
    </svg>
  );
}
