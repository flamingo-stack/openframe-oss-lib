import type { SVGProps } from "react";
export interface CloudWeatherDrizzleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CloudWeatherDrizzleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CloudWeatherDrizzleIconProps) {
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
        d="M19.875 10a2.88 2.88 0 0 0-2.158-2.785 1.125 1.125 0 0 1-.843-1.135l.001-.08a1.875 1.875 0 0 0-3.003-1.498 1.125 1.125 0 0 1-1.538-.173 3.375 3.375 0 0 0-5.918 2.704c.084.532-.22 1.05-.727 1.234a2.377 2.377 0 0 0 .81 4.608H17l.295-.015a2.876 2.876 0 0 0 2.58-2.86m2.25 0a5.125 5.125 0 0 1-4.862 5.118l-.264.007H6.5a4.625 4.625 0 0 1-2.374-8.593V6.5a5.625 5.625 0 0 1 9.256-4.295 4.12 4.12 0 0 1 5.68 3.101A5.13 5.13 0 0 1 22.126 10ZM7.211 20.367a1.125 1.125 0 0 1 2.078.865l-.5 1.2a1.125 1.125 0 1 1-2.077-.864zm7 0a1.125 1.125 0 0 1 2.078.865l-.5 1.2a1.125 1.125 0 0 1-2.078-.864zM6.29 19.133a1.125 1.125 0 0 1-2.078-.865zm6.5 0a1.125 1.125 0 0 1-2.078-.865zm6.5 0a1.126 1.126 0 0 1-2.077-.865zM4.711 17.068a1.125 1.125 0 1 1 2.077.864l-.5 1.201L5.25 18.7l-1.039-.432zm6.5 0a1.125 1.125 0 0 1 2.078.864l-.5 1.201-1.04-.433-1.038-.432zm6.5 0a1.125 1.125 0 0 1 2.078.864l-.5 1.201-1.039-.433-1.038-.432z"
      />
    </svg>
  );
}
