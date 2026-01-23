import type { SVGProps } from "react";
export interface UserLockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UserLockIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UserLockIconProps) {
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
        d="M17.125 20.875h3.75v-1.75h-3.75zm2.5-5.124a.626.626 0 0 0-1.25 0v1.124h1.25zm2.25 1.313A2.12 2.12 0 0 1 23.125 19v2A2.125 2.125 0 0 1 21 23.125h-4A2.125 2.125 0 0 1 14.875 21v-2c0-.862.513-1.602 1.25-1.936v-1.313a2.876 2.876 0 0 1 5.75 0zm-9.018-3.189q.138 0 .273.006l.27.017.115.017a1.124 1.124 0 0 1-.192 2.229l-.116-.004-.35-.015H7.143a4.014 4.014 0 0 0-4.005 3.75h8.864l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268zm.269-6.625a3.126 3.126 0 1 0-6.252.002 3.126 3.126 0 0 0 6.252-.002m2.25 0a5.376 5.376 0 1 1-10.75 0 5.376 5.376 0 0 1 10.75 0"
      />
    </svg>
  );
}
