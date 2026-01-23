import type { SVGProps } from "react";
export interface PlayCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PlayCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PlayCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M8.875 9.158c0-1.347 1.419-2.174 2.57-1.598l.226.134 3.843 2.663a2 2 0 0 1 0 3.287l-3.843 2.663c-1.18.818-2.796-.028-2.796-1.465zm2.25 4.789L13.935 12l-2.81-1.948z"
      />
    </svg>
  );
}
