import type { SVGProps } from "react";
export interface Download02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Download02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Download02IconProps) {
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
        d="M1.875 18v-4a1.125 1.125 0 0 1 2.25 0v4c0 1.036.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875v-4a1.125 1.125 0 0 1 2.25 0v4A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18"
      />
      <path
        fill={color}
        d="M10.874 3a1.125 1.125 0 0 1 2.25 0v7.285l3.081-3.08a1.125 1.125 0 0 1 1.59 1.59l-5 5c-.44.44-1.152.44-1.59 0l-5-5-.078-.085A1.126 1.126 0 0 1 7.71 7.128l.085.076 3.08 3.08z"
      />
    </svg>
  );
}
