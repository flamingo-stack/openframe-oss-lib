import type { SVGProps } from "react";
export interface LinkedinIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LinkedinIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LinkedinIconProps) {
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
        d="M20.875 15c0-2.127-1.768-3.875-3.921-3.875-.337 0-.674.06-.99.173l-.305.13-1.156.579a1.125 1.125 0 0 1-1.62-.882h-1.758v9.75h1.75V16a3.124 3.124 0 1 1 6.25 0v4.875h1.75v-5.876Zm2.25 6.5c0 .898-.727 1.625-1.625 1.625h-3a1.626 1.626 0 0 1-1.625-1.625V16a.874.874 0 1 0-1.75 0v5.5c0 .898-.728 1.625-1.626 1.625h-3A1.625 1.625 0 0 1 8.875 21.5v-11c0-.898.727-1.625 1.624-1.625h3c.472 0 .895.202 1.191.523a5.2 5.2 0 0 1 2.264-.523c3.368 0 6.17 2.729 6.171 6.124zm-20-.625h1.75v-9.75h-1.75zM4.875 4a.876.876 0 1 0-1.751.002A.876.876 0 0 0 4.875 4m2.25 17.5c0 .898-.728 1.625-1.625 1.625h-3A1.625 1.625 0 0 1 .875 21.5v-11c0-.897.727-1.625 1.625-1.625h3c.897 0 1.625.728 1.625 1.626zm0-17.5a3.126 3.126 0 1 1-6.25 0 3.126 3.126 0 0 1 6.25 0"
      />
    </svg>
  );
}
