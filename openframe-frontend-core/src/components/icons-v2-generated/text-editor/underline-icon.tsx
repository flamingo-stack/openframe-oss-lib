import type { SVGProps } from "react";
export interface UnderlineIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UnderlineIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UnderlineIconProps) {
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
        d="M21 19.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zM4.875 11V4a1.125 1.125 0 0 1 2.25 0v7a4.875 4.875 0 0 0 9.75 0V4a1.125 1.125 0 0 1 2.25 0v7a7.125 7.125 0 0 1-14.25 0"
      />
    </svg>
  );
}
