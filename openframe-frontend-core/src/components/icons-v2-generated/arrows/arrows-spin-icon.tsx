import type { SVGProps } from "react";
export interface ArrowsSpinIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowsSpinIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrowsSpinIconProps) {
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
        d="M3.001 10.874c.622 0 1.125.504 1.125 1.125l.015.465a7.9 7.9 0 0 0 1.573 4.277v-1.21a1.125 1.125 0 0 1 2.25 0v3.84c0 .62-.504 1.125-1.125 1.125H3a1.125 1.125 0 0 1 0-2.25h1.034a10.14 10.14 0 0 1-2.138-5.649l-.02-.596.006-.114a1.126 1.126 0 0 1 1.12-1.013ZM22.123 12a1.125 1.125 0 0 1-2.25.002zm-6.087-3.531V4.63c0-.621.503-1.125 1.125-1.125H21l.116.006a1.125 1.125 0 0 1 0 2.238L21 5.755h-1.034a10.14 10.14 0 0 1 2.157 6.244h-1.125l-1.125.002a7.9 7.9 0 0 0-1.587-4.743v1.21a1.125 1.125 0 0 1-2.25 0ZM12 1.876a1.125 1.125 0 0 1 0 2.25 7.9 7.9 0 0 0-4.742 1.588h1.21l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005H4.63A1.125 1.125 0 0 1 3.505 6.84V3a1.125 1.125 0 0 1 2.25 0v1.034a10.14 10.14 0 0 1 6.244-2.158ZM20.494 21a1.125 1.125 0 0 1-2.25 0v-1.036A10.14 10.14 0 0 1 12 22.124l-.114-.006A1.125 1.125 0 0 1 12 19.874l.464-.015a7.9 7.9 0 0 0 4.279-1.573H15.53a1.125 1.125 0 0 1 0-2.25h3.84c.62 0 1.125.503 1.125 1.125z"
      />
    </svg>
  );
}
