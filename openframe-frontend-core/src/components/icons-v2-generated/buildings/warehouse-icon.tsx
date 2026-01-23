import type { SVGProps } from "react";
export interface WarehouseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WarehouseIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WarehouseIconProps) {
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
        d="M10.875 11v-.875h-.75v3.75h3.75v-3.75h-.75v.874a1.125 1.125 0 0 1-2.25 0Zm5.25 2.875H17c1.173 0 2.125.952 2.125 2.125v5a1.125 1.125 0 0 1-2.25 0v-4.875h-.75V17a1.125 1.125 0 0 1-2.25 0v-.875h-.75V21a1.125 1.125 0 0 1-2.25 0v-4.875h-.75V17a1.125 1.125 0 0 1-2.25 0v-.875h-.75V21a1.125 1.125 0 0 1-2.25 0v-5c0-1.173.952-2.125 2.125-2.125h.875v-3.874c0-1.174.952-2.126 2.126-2.126h3.998c1.174 0 2.126.952 2.126 2.126z"
      />
      <path
        fill={color}
        d="M20.875 9.616c0-.63-.317-1.22-.843-1.566l-7-4.613a1.88 1.88 0 0 0-2.064 0l-7 4.613a1.88 1.88 0 0 0-.843 1.566V18c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zM23.125 18A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18V9.616c0-1.387.697-2.681 1.854-3.444L9.73 1.559a4.13 4.13 0 0 1 4.54 0l7 4.613a4.13 4.13 0 0 1 1.855 3.444z"
      />
    </svg>
  );
}
