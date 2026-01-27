import type { SVGProps } from "react";
export interface AlignLeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlignLeftIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlignLeftIconProps) {
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
        d="M14.875 15.5a.375.375 0 0 0-.375-.376h-6a.375.375 0 0 0-.375.375V16.5c0 .207.168.375.375.375h6a.375.375 0 0 0 .375-.375zm5-8a.375.375 0 0 0-.375-.375h-11a.375.375 0 0 0-.375.375v1c0 .207.168.375.375.375h11a.375.375 0 0 0 .375-.375zm-2.75 9a2.625 2.625 0 0 1-2.625 2.625h-6A2.625 2.625 0 0 1 5.875 16.5v-1A2.625 2.625 0 0 1 8.5 12.873h6a2.625 2.625 0 0 1 2.625 2.625zm5-8a2.625 2.625 0 0 1-2.625 2.626h-11A2.625 2.625 0 0 1 5.875 8.5v-1A2.625 2.625 0 0 1 8.5 4.875h11A2.625 2.625 0 0 1 22.125 7.5zM1.875 21V3a1.125 1.125 0 0 1 2.25 0v18a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
