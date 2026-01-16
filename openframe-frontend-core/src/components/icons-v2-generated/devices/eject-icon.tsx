import type { SVGProps } from "react";
export interface EjectIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EjectIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: EjectIconProps) {
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
        d="m20 18.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H4a1.125 1.125 0 0 1 0-2.25zM9.552 4.059c1.286-1.629 3.813-1.575 5.017.163l6.085 8.783c1.206 1.74-.04 4.12-2.158 4.12H5.505c-2.118 0-3.364-2.38-2.158-4.12l6.085-8.783zm3.167 1.444a.875.875 0 0 0-1.439 0l-6.085 8.784a.376.376 0 0 0 .31.588h12.991c.265 0 .435-.26.358-.492l-.05-.096z"
      />
    </svg>
  );
}
