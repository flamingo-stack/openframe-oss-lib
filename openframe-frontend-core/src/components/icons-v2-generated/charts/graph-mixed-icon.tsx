import type { SVGProps } from "react";
export interface GraphMixedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GraphMixedIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: GraphMixedIconProps) {
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
        d="M1.875 18V3a1.125 1.125 0 0 1 2.25 0v15c0 1.035.84 1.875 1.875 1.875h15a1.125 1.125 0 0 1 0 2.25H6A4.125 4.125 0 0 1 1.875 18"
      />
      <path
        fill={color}
        d="M5.875 17v-1.5a1.125 1.125 0 0 1 2.25 0V17a1.125 1.125 0 0 1-2.25 0m4.333 0v-4.5a1.126 1.126 0 0 1 2.25 0V17a1.125 1.125 0 0 1-2.25 0m4.333 0v-3a1.126 1.126 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m4.334 0v-6.5a1.125 1.125 0 0 1 2.25 0V17a1.125 1.125 0 0 1-2.25 0m1.33-14.795a1.125 1.125 0 0 1 1.59 1.59L17.5 8.092a2.63 2.63 0 0 1-3.208.395l-1.74-1.044a.376.376 0 0 0-.459.056l-4.298 4.296a1.125 1.125 0 1 1-1.59-1.59l4.297-4.297a2.625 2.625 0 0 1 3.207-.394l1.742 1.044a.374.374 0 0 0 .457-.057z"
      />
    </svg>
  );
}
