import type { SVGProps } from "react";
export interface Flag03IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Flag03Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Flag03IconProps) {
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
        d="M2.935 2.638c.187-.551.76-.863 1.315-.735l.112.032 14.98 5.079.216.083c2.157.93 2.085 4.108-.217 4.888l-14.98 5.08-.11.031a1.124 1.124 0 0 1-.613-2.162L18.62 9.855a.375.375 0 0 0 0-.71L3.64 4.065l-.108-.043a1.125 1.125 0 0 1-.596-1.384Z"
      />
      <path
        fill={color}
        d="M2.875 22V2a1.125 1.125 0 0 1 2.25 0v20a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
