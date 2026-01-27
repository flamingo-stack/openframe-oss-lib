import type { SVGProps } from "react";
export interface PercentStrokeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PercentStrokeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PercentStrokeIconProps) {
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
        d="M18.204 4.205a1.125 1.125 0 0 1 1.59 1.59l-13.999 14a1.125 1.125 0 1 1-1.59-1.59zM17.875 17a.874.874 0 1 0-1.749 0 .874.874 0 0 0 1.748 0Zm-10-10a.876.876 0 1 0-1.751.002A.876.876 0 0 0 7.875 7m12.25 10a3.124 3.124 0 1 1-6.249 0 3.124 3.124 0 0 1 6.249 0m-10-10a3.126 3.126 0 1 1-6.25 0 3.126 3.126 0 0 1 6.25 0"
      />
    </svg>
  );
}
