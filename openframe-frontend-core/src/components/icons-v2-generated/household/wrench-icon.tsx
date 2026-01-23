import type { SVGProps } from "react";
export interface WrenchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WrenchIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WrenchIconProps) {
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
        d="M12.19 2.467a6.63 6.63 0 0 1 6.826-1.097 1.125 1.125 0 0 1 .369 1.836L16.22 6.37l.234 1.173 1.173.236 3.166-3.164.104-.092a1.126 1.126 0 0 1 1.731.461 6.63 6.63 0 0 1-1.445 7.201 6.62 6.62 0 0 1-6.47 1.69l-8.296 8.297a3.247 3.247 0 0 1-4.345.223l-.246-.223a3.246 3.246 0 0 1 0-4.59l8.296-8.297a6.62 6.62 0 0 1 1.692-6.469zm4.086.664a4.377 4.377 0 0 0-3.825 6.032c.172.42.075.901-.245 1.222l-8.788 8.787a.997.997 0 0 0 0 1.41l.157.127a1 1 0 0 0 1.252-.127l8.788-8.788.127-.11a1.13 1.13 0 0 1 1.096-.136 4.376 4.376 0 0 0 6.03-3.826l-2.072 2.074a1.13 1.13 0 0 1-1.017.308l-2.5-.501a1.12 1.12 0 0 1-.882-.882l-.501-2.5c-.074-.37.042-.75.308-1.016z"
      />
    </svg>
  );
}
