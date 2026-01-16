import type { SVGProps } from "react";
export interface PinVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PinVrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PinVrIconProps) {
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
        d="M10.875 21v-4a1.125 1.125 0 1 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M15.893 5a.875.875 0 0 0-.875-.875h-6.04A.876.876 0 0 0 8.104 5v.531l.68.66c.22.213.342.505.342.81V10.5c0 .342-.155.665-.422.879-1.04.832-1.631 1.504-1.99 2.177-.334.625-.51 1.333-.576 2.319H17.86c-.066-.99-.237-1.698-.567-2.324-.354-.67-.94-1.341-1.977-2.172a1.13 1.13 0 0 1-.422-.873l-.02-3.5a1.13 1.13 0 0 1 .34-.811l.679-.662zm2.25.585c0 .564-.224 1.105-.623 1.503l-.009.01-.385.374.015 2.495c.952.813 1.657 1.617 2.141 2.535.557 1.056.77 2.168.837 3.44.064 1.236-.947 2.183-2.1 2.183H5.978c-1.155 0-2.165-.947-2.101-2.183l.032-.472c.094-1.083.325-2.05.818-2.973.488-.915 1.197-1.717 2.147-2.527V7.475L6.488 7.1l-.013-.012a2.13 2.13 0 0 1-.622-1.503V5c0-1.726 1.4-3.125 3.126-3.125h6.04A3.125 3.125 0 0 1 18.142 5v.585Z"
      />
    </svg>
  );
}
