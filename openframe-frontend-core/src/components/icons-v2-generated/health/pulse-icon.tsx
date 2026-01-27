import type { SVGProps } from "react";
export interface PulseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PulseIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PulseIconProps) {
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
        d="M13.51 3.125c.361-1.612 2.685-1.68 3.14-.092l.038.164 2.241 11.677H22l.116.006a1.125 1.125 0 0 1 0 2.239l-.115.005h-4c-.54 0-1.004-.382-1.105-.912l-1.688-8.79-1.746 13.296c-.227 1.725-2.602 1.91-3.142.335l-.047-.158-2.215-8.97-.96 4.319c-.114.515-.57.88-1.097.88H2a1.125 1.125 0 0 1 0-2.25h3.098L6.44 8.838l.04-.153c.462-1.475 2.58-1.5 3.079-.036l.044.15 2.058 8.34 1.82-13.847.03-.167Z"
      />
    </svg>
  );
}
