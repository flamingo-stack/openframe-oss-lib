import type { SVGProps } from "react";
export interface SodaCanIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SodaCanIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SodaCanIconProps) {
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
        d="M18 16.875a1.125 1.125 0 0 1 0 2.25H6a1.125 1.125 0 0 1 0-2.25zM12.874 12a.874.874 0 1 0-1.748 0 .874.874 0 0 0 1.748 0M18 4.875a1.125 1.125 0 0 1 0 2.25H6a1.125 1.125 0 0 1 0-2.25zM15.124 12a3.124 3.124 0 1 1-6.248 0 3.124 3.124 0 0 1 6.248 0"
      />
      <path
        fill={color}
        d="M16.875 5.724a.9.9 0 0 0-.116-.435l-.086-.125-1.7-2.039H9.027l-1.7 2.04a.88.88 0 0 0-.203.559v12.67c0 .173.05.342.146.485l1.071 1.606.066.086a.87.87 0 0 0 .662.303h5.86a.88.88 0 0 0 .728-.39l1.07-1.605.063-.11a.9.9 0 0 0 .084-.374V5.724Zm2.25 12.67c0 .617-.182 1.22-.524 1.733l-1.071 1.606a3.13 3.13 0 0 1-2.6 1.392H9.07c-.98 0-1.898-.459-2.487-1.232l-.113-.16-1.07-1.606a3.13 3.13 0 0 1-.525-1.732V5.724c0-.731.256-1.439.724-2l.549-.66A1.121 1.121 0 0 1 6.5.874h11l.115.006a1.12 1.12 0 0 1 .236 2.183l.55.66.166.217c.362.521.558 1.143.558 1.783z"
      />
    </svg>
  );
}
