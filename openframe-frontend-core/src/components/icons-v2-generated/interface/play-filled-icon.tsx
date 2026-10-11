import type { SVGProps } from "react";
export interface PlayFilledIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PlayFilledIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PlayFilledIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="m6 21 15-9L6 3z" />
    </svg>
  );
}
