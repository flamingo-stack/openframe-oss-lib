import type { SVGProps } from "react";
export interface FontAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FontAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FontAltIconProps) {
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
        d="M10.563 3.669c.65-1.059 2.224-1.059 2.874 0l.125.243 6.295 14.963H21l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-4a1.126 1.126 0 0 1 0-2.25h.417l-.923-2.194H7.506l-.923 2.194H7l.115.006a1.126 1.126 0 0 1 0 2.238L7 21.125H3a1.125 1.125 0 0 1 0-2.25h1.143l6.295-14.963zM8.453 14.43h7.095L12 6.002l-3.548 8.43Z"
      />
    </svg>
  );
}
