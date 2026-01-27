import type { SVGProps } from "react";
export interface CameraRetro02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CameraRetro02Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CameraRetro02IconProps) {
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
        d="M20.875 8c0-1.036-.84-1.875-1.875-1.875h-.586a2.12 2.12 0 0 1-1.502-.623l-1.378-1.377h-3.068l-1.378 1.377a2.12 2.12 0 0 1-1.502.623H5c-1.035 0-1.875.84-1.875 1.875v10c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18V8c0-1.5.803-2.809 2-3.53V4c0-.62.503-1.124 1.125-1.125h2c.58 0 1.056.437 1.118 1h2.416l1.378-1.377.155-.141c.378-.31.854-.482 1.347-.482h3.172c.493 0 .969.172 1.347.482l.155.14 1.378 1.378H19A4.125 4.125 0 0 1 23.125 8z"
      />
      <path
        fill={color}
        d="M16.875 12.5a2.876 2.876 0 1 0-5.752.001 2.876 2.876 0 0 0 5.752 0ZM7 7.876l.115.005a1.126 1.126 0 0 1 0 2.239L7 10.124H6a1.125 1.125 0 1 1 0-2.25h1ZM19.125 12.5a5.125 5.125 0 1 1-10.25-.003 5.125 5.125 0 0 1 10.25.003"
      />
    </svg>
  );
}
