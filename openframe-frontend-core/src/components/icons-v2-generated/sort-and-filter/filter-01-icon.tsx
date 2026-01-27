import type { SVGProps } from "react";
export interface Filter01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Filter01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Filter01IconProps) {
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
        d="M19.875 5A.875.875 0 0 0 19 4.125H5A.875.875 0 0 0 4.125 5v2.534l5.377 5.377.141.157c.31.378.482.853.482 1.346v3.504l3.75 1.875v-5.379c0-.563.224-1.104.623-1.503l5.377-5.377zm2.25 2.586c0 .494-.172.969-.482 1.347l-.14.155-5.378 5.377v5.532c0 1.48-1.461 2.476-2.808 2.012l-.267-.113-4-1.999a2.13 2.13 0 0 1-1.175-1.901v-3.53L2.498 9.087a2.13 2.13 0 0 1-.623-1.502V5A3.125 3.125 0 0 1 5 1.875h14A3.125 3.125 0 0 1 22.125 5z"
      />
    </svg>
  );
}
