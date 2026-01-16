import type { SVGProps } from "react";
export interface GridPlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GridPlusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: GridPlusIconProps) {
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
        d="M8.875 15.5a.376.376 0 0 0-.375-.376h-4a.375.375 0 0 0-.375.375V19.5c0 .207.168.375.375.375h4a.375.375 0 0 0 .375-.375zm11-11a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.376.375v4c0 .207.169.375.375.375H19.5a.375.375 0 0 0 .375-.375zm-8.75 15A2.625 2.625 0 0 1 8.5 22.125h-4A2.625 2.625 0 0 1 1.875 19.5v-4A2.625 2.625 0 0 1 4.5 12.873h4a2.626 2.626 0 0 1 2.626 2.625zm11-11a2.625 2.625 0 0 1-2.625 2.626h-4A2.626 2.626 0 0 1 12.873 8.5v-4A2.625 2.625 0 0 1 15.5 1.875h4A2.625 2.625 0 0 1 22.125 4.5zm-5.75 12v-1.875h-1.874a1.125 1.125 0 0 1 0-2.25h1.874v-1.874a1.125 1.125 0 0 1 2.25 0v1.874H20.5l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.005h-1.876V20.5a1.126 1.126 0 0 1-2.25 0m-7.5-16a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.375.375v4c0 .207.168.375.375.375h4a.376.376 0 0 0 .375-.375zm2.25 4A2.626 2.626 0 0 1 8.5 11.126h-4A2.625 2.625 0 0 1 1.875 8.5v-4A2.625 2.625 0 0 1 4.5 1.875h4A2.625 2.625 0 0 1 11.126 4.5z"
      />
    </svg>
  );
}
