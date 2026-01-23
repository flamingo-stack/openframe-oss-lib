import type { SVGProps } from "react";
export interface Upload02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Upload02Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Upload02IconProps) {
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
        d="M10.874 13a1.125 1.125 0 0 0 2.25 0V5.715l3.081 3.08a1.125 1.125 0 0 0 1.59-1.59l-5-5a1.125 1.125 0 0 0-1.59 0l-5 5-.078.085A1.126 1.126 0 0 0 7.71 8.872l.085-.076 3.08-3.08z"
      />
    </svg>
  );
}
