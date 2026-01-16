import type { SVGProps } from "react";
export interface AlignTopIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlignTopIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlignTopIconProps) {
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
        d="M8.875 8.5a.375.375 0 0 0-.375-.375h-1a.375.375 0 0 0-.375.375v11c0 .207.168.375.375.375h1a.375.375 0 0 0 .375-.375zm7.993-.076a.376.376 0 0 0-.368-.299h-1a.375.375 0 0 0-.376.375v6l.01.076c.034.17.185.299.365.299H16.5l.076-.007a.376.376 0 0 0 .299-.368v-6zM11.126 19.5a2.626 2.626 0 0 1-2.357 2.611l-.269.014h-1A2.625 2.625 0 0 1 4.875 19.5v-11A2.625 2.625 0 0 1 7.5 5.875h1A2.625 2.625 0 0 1 11.126 8.5zm7.999-5a2.625 2.625 0 0 1-2.625 2.625h-1a2.625 2.625 0 0 1-2.626-2.625v-6A2.625 2.625 0 0 1 15.5 5.875h1A2.625 2.625 0 0 1 19.125 8.5zM21 4.125a1.125 1.125 0 0 0 0-2.25H3a1.125 1.125 0 0 0 0 2.25z"
      />
    </svg>
  );
}
