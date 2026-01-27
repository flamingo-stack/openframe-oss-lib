import type { SVGProps } from "react";
export interface Chevrons04HrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevrons04HrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Chevrons04HrIconProps) {
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
        d="M20.204 18.795a1.125 1.125 0 1 0 1.591-1.59L16.591 12l5.204-5.205.078-.085a1.126 1.126 0 0 0-1.584-1.583l-.085.078-6 6a1.124 1.124 0 0 0 0 1.59zm-17.999 0a1.125 1.125 0 0 0 1.505.078l.085-.078 6-6a1.125 1.125 0 0 0 0-1.59l-6-6a1.125 1.125 0 1 0-1.59 1.59L7.409 12l-5.204 5.205-.078.085a1.126 1.126 0 0 0 .078 1.505"
      />
    </svg>
  );
}
