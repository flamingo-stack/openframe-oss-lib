import type { SVGProps } from "react";
export interface Chevron01RightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevron01RightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevron01RightIconProps) {
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
        d="M7.205 3.205a1.125 1.125 0 0 1 1.505-.078l.085.078 8 8a1.126 1.126 0 0 1 0 1.59l-8 8a1.125 1.125 0 0 1-1.59-1.59L14.409 12 7.205 4.794l-.078-.085a1.125 1.125 0 0 1 .078-1.505Z"
      />
    </svg>
  );
}
