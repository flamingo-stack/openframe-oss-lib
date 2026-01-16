import type { SVGProps } from "react";
export interface InstagramIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function InstagramIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: InstagramIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M14.874 12a2.875 2.875 0 1 0-5.75 0 2.875 2.875 0 0 0 5.75 0M17.5 5.376l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-.01a1.125 1.125 0 0 1 0-2.25zm-.375 6.626a5.124 5.124 0 1 1-10.249 0 5.124 5.124 0 0 1 10.248 0Z"
      />
    </svg>
  );
}
