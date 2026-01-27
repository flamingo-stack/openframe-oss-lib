import type { SVGProps } from "react";
export interface VectorBezierCurveIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VectorBezierCurveIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: VectorBezierCurveIconProps) {
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
        d="M5.113 15.16a1.126 1.126 0 0 1-2.226-.319l2.226.318Zm14.999-9.28a1.125 1.125 0 0 1-.11 2.245l-1.973.004c1.668 1.693 2.71 4.089 3.085 6.712a1.126 1.126 0 0 1-2.228.318c-.526-3.681-2.455-6.316-5.181-7.059a1.126 1.126 0 0 1 .293-2.21l6-.015zm-10.11.01a1.124 1.124 0 0 1 .294 2.21c-2.727.743-4.657 3.378-5.183 7.06L4 15l-1.113-.159C3.26 12.218 4.3 9.821 5.969 8.13l-1.972-.004-.114-.006a1.126 1.126 0 0 1 .12-2.244l6 .015Z"
      />
      <path
        fill={color}
        d="M4.875 17a.875.875 0 1 0-1.75.002.875.875 0 0 0 1.75-.002m16 0a.874.874 0 1 0-1.749 0 .874.874 0 0 0 1.748 0Zm-8-10a.875.875 0 1 0-1.75 0 .875.875 0 0 0 1.75 0M3.217 4.886A2.125 2.125 0 1 1 .885 7.218L.875 7l.01-.217A2.126 2.126 0 0 1 3 4.875l.217.01Zm18 0a2.125 2.125 0 1 1-2.332 2.332L18.875 7l.01-.217A2.126 2.126 0 0 1 21 4.875l.217.01ZM7.125 17a3.125 3.125 0 1 1-6.25-.002 3.125 3.125 0 0 1 6.25.002m16 0a3.124 3.124 0 1 1-6.249 0 3.124 3.124 0 0 1 6.248 0Zm-8-10a3.126 3.126 0 1 1-6.252 0 3.126 3.126 0 0 1 6.252 0"
      />
    </svg>
  );
}
