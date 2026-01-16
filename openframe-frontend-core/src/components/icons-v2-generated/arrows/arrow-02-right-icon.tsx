import type { SVGProps } from "react";
export interface Arrow02RightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Arrow02RightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Arrow02RightIconProps) {
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
        d="M19.875 17V7a1.125 1.125 0 0 1 2.25 0v10a1.125 1.125 0 0 1-2.25 0M10.204 6.205a1.126 1.126 0 0 1 1.506-.078l.085.078 5 5a1.126 1.126 0 0 1 0 1.59l-5 5a1.125 1.125 0 0 1-1.59-1.59l3.08-3.08H3a1.125 1.125 0 0 1 0-2.25h10.285l-3.08-3.08-.077-.085a1.125 1.125 0 0 1 .076-1.505"
      />
    </svg>
  );
}
