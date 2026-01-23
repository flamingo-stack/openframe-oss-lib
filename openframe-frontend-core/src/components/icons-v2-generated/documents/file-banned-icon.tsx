import type { SVGProps } from "react";
export interface FileBannedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileBannedIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FileBannedIconProps) {
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
        d="M2.875 19V5A4.125 4.125 0 0 1 7 .875h6.586c.293 0 .58.063.844.177l.022.009q.258.115.48.296l.157.14 5.414 5.415c.18.18.322.39.426.618q.012.022.022.047c.113.262.174.547.174.838v1.844a1.125 1.125 0 0 1-2.25 0V9.125H16A3.125 3.125 0 0 1 12.876 6V3.125H7c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h4.077l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H7A4.125 4.125 0 0 1 2.875 19m12.25-13c0 .484.392.875.875.875h1.285l-2.16-2.16z"
      />
      <path
        fill={color}
        d="M20.875 18a2.875 2.875 0 0 0-3.95-2.665l3.74 3.74c.134-.333.21-.695.21-1.075m-5.75 0a2.875 2.875 0 0 0 3.95 2.665l-3.74-3.74c-.135.332-.21.695-.21 1.075m8 0a5.124 5.124 0 1 1-10.249 0 5.124 5.124 0 0 1 10.249 0"
      />
    </svg>
  );
}
