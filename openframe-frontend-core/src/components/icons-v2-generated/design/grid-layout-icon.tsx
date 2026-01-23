import type { SVGProps } from "react";
export interface GridLayoutIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GridLayoutIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GridLayoutIconProps) {
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
        d="M8.875 13.5a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.375.375v6c0 .207.168.375.375.375h4a.375.375 0 0 0 .375-.375zm11-9a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.376.375v6c0 .207.169.375.375.375H19.5a.375.375 0 0 0 .375-.375zm-8.75 15A2.625 2.625 0 0 1 8.5 22.125h-4A2.625 2.625 0 0 1 1.875 19.5v-6A2.625 2.625 0 0 1 4.5 10.875h4a2.625 2.625 0 0 1 2.626 2.625zm11-9a2.625 2.625 0 0 1-2.625 2.625h-4a2.625 2.625 0 0 1-2.626-2.625v-6A2.625 2.625 0 0 1 15.5 1.875h4A2.625 2.625 0 0 1 22.125 4.5zm-2.25 7a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.376.375v2c0 .207.169.375.375.375H19.5a.375.375 0 0 0 .375-.375zm-11-13a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.375.375v2c0 .207.168.375.375.375h4a.375.375 0 0 0 .375-.375zm13.25 15a2.625 2.625 0 0 1-2.625 2.625h-4a2.625 2.625 0 0 1-2.626-2.625v-2a2.625 2.625 0 0 1 2.625-2.624H19.5a2.625 2.625 0 0 1 2.625 2.624zm-11-13A2.625 2.625 0 0 1 8.5 9.125h-4A2.625 2.625 0 0 1 1.875 6.5v-2A2.625 2.625 0 0 1 4.5 1.875h4A2.625 2.625 0 0 1 11.126 4.5z"
      />
    </svg>
  );
}
