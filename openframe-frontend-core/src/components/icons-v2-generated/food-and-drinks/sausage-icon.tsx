import type { SVGProps } from "react";
export interface SausageIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SausageIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SausageIconProps) {
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
        d="M2.57 15.96c.42-.173.904-.078 1.225.244l1.5 1.5c.44.44.44 1.152 0 1.59l-1.5 1.5A1.125 1.125 0 0 1 1.875 20v-3c0-.455.274-.865.694-1.04ZM20 1.876a1.126 1.126 0 0 1 .795 1.92l-1.5 1.5c-.44.44-1.152.44-1.59 0l-1.5-1.5A1.125 1.125 0 0 1 17 1.875z"
      />
      <path
        fill={color}
        d="M19.875 9.263V7.552a1.427 1.427 0 0 0-2.853 0v1.71a7.76 7.76 0 0 1-7.76 7.76h-1.71a1.427 1.427 0 0 0 0 2.854h1.71c5.862 0 10.613-4.752 10.613-10.613m2.25 0c0 7.103-5.759 12.862-12.862 12.862H7.552a3.677 3.677 0 0 1 0-7.353h1.71a5.51 5.51 0 0 0 5.51-5.51v-1.71a3.677 3.677 0 0 1 7.353 0z"
      />
    </svg>
  );
}
