import type { SVGProps } from "react";
export interface AvatarCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AvatarCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AvatarCircleIconProps) {
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
        d="M13.912 15.376a7.13 7.13 0 0 1 5.798 2.983l.133.185.061.097a1.124 1.124 0 0 1-1.82 1.302l-.072-.09-.132-.187a4.88 4.88 0 0 0-3.968-2.04h-3.825a4.87 4.87 0 0 0-3.788 1.807l-.179.233-.132.186-.071.09a1.125 1.125 0 0 1-1.76-1.398l.132-.185.26-.342a7.13 7.13 0 0 1 5.538-2.641zm.214-5.626a2.126 2.126 0 1 0-4.252.001 2.126 2.126 0 0 0 4.252 0Zm2.25 0a4.375 4.375 0 1 1-8.75-.002 4.375 4.375 0 0 1 8.75.002"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
