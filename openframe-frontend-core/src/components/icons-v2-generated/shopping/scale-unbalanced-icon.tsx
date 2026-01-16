import type { SVGProps } from "react";
export interface ScaleUnbalancedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ScaleUnbalancedIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ScaleUnbalancedIconProps) {
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
        d="M12 1c1.052 0 1.975.542 2.51 1.361l3.773-.838.1-.016a1 1 0 0 1 .334 1.97l-3.733.829A3 3 0 0 1 13 6.826V21h5.5a1 1 0 1 1 0 2h-13a1 1 0 1 1 0-2H11V6.825a3 3 0 0 1-1.512-1.187l-3.771.839a1 1 0 0 1-.434-1.954l3.732-.83A3 3 0 0 1 12 1m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      />
      <path
        fill={color}
        d="M3.674 8.568c.555-1.065 2.097-1.065 2.652 0l.053.11 2.54 5.928A1 1 0 0 1 9 15c0 1.735-1.309 4-4 4s-4-2.265-4-4a1 1 0 0 1 .081-.394l2.54-5.928zm-.665 6.615C3.093 16.066 3.777 17 5 17s1.906-.934 1.99-1.817L5 10.54zm14.665-9.615c.555-1.065 2.097-1.065 2.652 0l.053.11 2.54 5.928A1 1 0 0 1 23 12c0 1.735-1.309 4-4 4s-4-2.265-4-4c0-.136.028-.27.081-.394l2.54-5.928zm-.665 6.615C17.093 13.066 17.777 14 19 14s1.906-.934 1.99-1.817L19 7.54l-1.991 4.644Z"
      />
    </svg>
  );
}
