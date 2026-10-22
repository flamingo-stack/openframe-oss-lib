import type { SVGProps } from "react";
export interface OpenframeLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
  secondaryColor?: string;
}
export function OpenframeLogoIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  secondaryColor = "var(--color-accent-primary)",
  ...props
}: OpenframeLogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <g fill={secondaryColor}>
        <path d="M21.333 16.533c0-.294.24-.533.534-.533h4.266c.295 0 .534.239.534.533V20.8a.533.533 0 0 1-.534.533h-4.266a.533.533 0 0 1-.534-.533zM16 21.867c0-.295.239-.534.533-.534H20.8c.295 0 .533.24.533.534v4.266a.533.533 0 0 1-.533.534h-4.267a.533.533 0 0 1-.533-.534zM26.667 21.867c0-.295.238-.534.533-.534h4.267c.294 0 .533.24.533.534v4.266a.533.533 0 0 1-.533.534H27.2a.533.533 0 0 1-.533-.534zM21.333 27.2c0-.295.24-.533.534-.533h4.266c.295 0 .534.238.534.533v4.267a.533.533 0 0 1-.534.533h-4.266a.533.533 0 0 1-.534-.533z" />
      </g>
      <path
        fill={color}
        d="M30.933 0H1.067C.477 0 0 .478 0 1.067v29.866C0 31.523.478 32 1.067 32h13.866c.59 0 1.067-.478 1.067-1.067v-3.2c0-.589-.478-1.066-1.067-1.066H5.867a.533.533 0 0 1-.534-.534V5.867c0-.295.24-.534.534-.534h20.266c.295 0 .534.24.534.534v9.066c0 .59.477 1.067 1.066 1.067h3.2c.59 0 1.067-.478 1.067-1.067V1.067C32 .477 31.522 0 30.933 0"
      />
    </svg>
  );
}
