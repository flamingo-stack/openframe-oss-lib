import type { SVGProps } from "react";
export interface Chevron01LeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevron01LeftIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevron01LeftIconProps) {
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
        d="M15.204 3.205a1.125 1.125 0 0 1 1.591 1.59L9.589 12l7.206 7.206.078.085a1.126 1.126 0 0 1-1.582 1.582l-.087-.076-8-8.001a1.125 1.125 0 0 1 0-1.59l8-8Z"
      />
    </svg>
  );
}
