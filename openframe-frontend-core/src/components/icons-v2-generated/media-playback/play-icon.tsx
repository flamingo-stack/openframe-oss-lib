import type { SVGProps } from "react";
export interface PlayIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PlayIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PlayIconProps) {
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
        d="M4.875 5.006c0-2.501 2.793-3.989 4.87-2.592l9.78 6.578c2.135 1.437 2.135 4.58 0 6.016l-9.78 6.579c-2.077 1.396-4.87-.091-4.87-2.593zm2.25 13.988c0 .7.783 1.118 1.364.727l9.78-6.58c.81-.545.81-1.738 0-2.283L8.488 4.28a.875.875 0 0 0-1.364.726v13.988Z"
      />
    </svg>
  );
}
