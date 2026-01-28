import type { SVGProps } from "react";
export interface PythonLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PythonLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PythonLogoIconProps) {
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
        d="M11.966 2C7.244 2 7.193 3.833 7.193 4.21V6.5h4.864v.687H5.26C3.816 7.187 2 8.067 2 11.96c0 3.577 1.417 4.96 2.847 4.96h1.698v-2.386c0-.998.495-2.847 2.802-2.847h4.823c.71 0 2.71-.308 2.71-2.619V4.665C16.88 4.09 16.784 2 11.967 2M9.284 3.54a.874.874 0 1 1 0 1.75.874.874 0 1 1 0-1.75"
      />
      <path
        fill={color}
        d="M12.034 22c4.72 0 4.778-1.867 4.778-2.21V17.5h-4.869v-.687h6.795c1.457 0 3.262-.901 3.262-4.773 0-4.24-1.916-4.96-2.847-4.96h-1.699v2.386c0 .998-.478 2.847-2.8 2.847H9.828c-.707 0-2.71.344-2.71 2.619v4.403c0 .951.581 2.665 4.915 2.665m2.682-1.54a.874.874 0 1 1-.002-1.748.874.874 0 0 1 .002 1.748"
      />
    </svg>
  );
}
