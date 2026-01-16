import type { SVGProps } from "react";
export interface SmokingOffCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SmokingOffCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SmokingOffCircleIconProps) {
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
        d="m12 10.874.115.006a1.12 1.12 0 0 1 .583 1.996h1.303l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H5.5A1.125 1.125 0 0 1 4.375 14v-2.002c0-.62.504-1.125 1.125-1.125zm6.5 0c.621 0 1.125.505 1.125 1.125v.843a1.125 1.125 0 0 1-2.22.253 1.125 1.125 0 0 1 .249-2.22zM15.374 8.5A.375.375 0 0 0 15 8.125h-.998A2.625 2.625 0 0 1 11.376 5.5a1.125 1.125 0 0 1 2.25 0c0 .207.167.375.375.375h.998A2.625 2.625 0 0 1 17.625 8.5a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M20.875 12A8.875 8.875 0 0 0 6.572 4.982l12.447 12.447A8.83 8.83 0 0 0 20.875 12m-17.75 0a8.875 8.875 0 0 0 14.303 7.019L4.98 6.572A8.84 8.84 0 0 0 3.125 12m20 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
