import type { SVGProps } from "react";
export interface AlignBottomIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlignBottomIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlignBottomIconProps) {
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
        d="M8.875 4.5a.375.375 0 0 0-.375-.375h-1a.375.375 0 0 0-.375.375v11c0 .207.168.374.375.374h1a.375.375 0 0 0 .375-.375zm8 5a.375.375 0 0 0-.299-.367l-.076-.008h-1a.376.376 0 0 0-.376.375v6c0 .207.169.374.375.374H16.5a.375.375 0 0 0 .375-.375zm2.25 6a2.625 2.625 0 0 1-2.625 2.625h-1a2.625 2.625 0 0 1-2.626-2.626v-6A2.626 2.626 0 0 1 15.5 6.876h1A2.625 2.625 0 0 1 19.125 9.5zm-8 0a2.626 2.626 0 0 1-2.355 2.61l-.269.014h-1a2.625 2.625 0 0 1-2.625-2.626V4.5A2.625 2.625 0 0 1 7.5 1.875h1A2.625 2.625 0 0 1 11.126 4.5zM21 19.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
