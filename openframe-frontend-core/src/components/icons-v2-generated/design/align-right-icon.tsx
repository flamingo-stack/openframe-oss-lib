import type { SVGProps } from "react";
export interface AlignRightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlignRightIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlignRightIconProps) {
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
        d="M15.874 15.5a.375.375 0 0 0-.375-.376h-6a.376.376 0 0 0-.374.375V16.5c0 .207.168.375.375.375h6a.375.375 0 0 0 .374-.375zm0-8a.375.375 0 0 0-.375-.375H4.5a.375.375 0 0 0-.375.375v1c0 .207.168.375.375.375h11a.375.375 0 0 0 .374-.375zm2.25 9a2.625 2.625 0 0 1-2.624 2.625h-6A2.625 2.625 0 0 1 6.875 16.5v-1A2.626 2.626 0 0 1 9.5 12.873h6a2.625 2.625 0 0 1 2.625 2.625V16.5Zm0-8a2.625 2.625 0 0 1-2.624 2.626h-11A2.625 2.625 0 0 1 1.875 8.5v-1A2.625 2.625 0 0 1 4.5 4.875h11A2.625 2.625 0 0 1 18.124 7.5zM19.875 3v18a1.125 1.125 0 0 0 2.25 0V3a1.125 1.125 0 0 0-2.25 0"
      />
    </svg>
  );
}
