import type { SVGProps } from "react";
export interface UserPlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UserPlusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: UserPlusIconProps) {
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
        d="M17.875 21v-1.875H16a1.125 1.125 0 0 1 0-2.25h1.875V15a1.125 1.125 0 0 1 2.25 0v1.875H22a1.125 1.125 0 0 1 0 2.25h-1.875V21a1.125 1.125 0 0 1-2.25 0m-5.018-7.125q.147 0 .292.007l.287.02.114.016a1.125 1.125 0 0 1-.205 2.229l-.114-.004-.374-.018H7.143a4.014 4.014 0 0 0-4.005 3.75h10.22l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268zm.269-6.625a3.126 3.126 0 1 0-6.252.002 3.126 3.126 0 0 0 6.252-.002m2.25 0a5.376 5.376 0 1 1-10.75 0 5.376 5.376 0 0 1 10.75 0"
      />
    </svg>
  );
}
