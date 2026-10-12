import type { SVGProps } from "react";
export interface LivestormIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LivestormIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LivestormIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      viewBox="0 0 140 140"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="M77.886 33.406H33.112a7.17 7.17 0 0 0 0 14.342h44.774a7.17 7.17 0 0 0 0-14.342M92.546 62.823H47.772a7.17 7.17 0 0 0 0 14.342h44.774a7.17 7.17 0 1 0 0-14.342M77.887 92.252H62.432a7.17 7.17 0 0 0 0 14.342h15.455a7.171 7.171 0 0 0 0-14.342M114.058 40.577a7.17 7.17 0 1 0-14.341 0 7.17 7.17 0 0 0 14.341 0" />
    </svg>
  );
}
