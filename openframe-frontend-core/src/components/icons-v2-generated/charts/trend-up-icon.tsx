import type { SVGProps } from "react";
export interface TrendUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TrendUpIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TrendUpIconProps) {
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
        d="M20.205 6.205a1.125 1.125 0 1 1 1.59 1.59L16.4 13.192a3.13 3.13 0 0 1-3.584.596l-.235-.127-2.321-1.393a.875.875 0 0 0-1.068.131l-5.397 5.397a1.125 1.125 0 0 1-1.59-1.59L7.6 10.808a3.13 3.13 0 0 1 3.818-.47l2.322 1.392a.874.874 0 0 0 1.068-.131l5.397-5.395Z"
      />
      <path
        fill={color}
        d="M20.997 5.872c.621 0 1.125.504 1.125 1.125l.003 5.502-.005.115a1.126 1.126 0 0 1-2.239.002l-.006-.116-.003-4.378H15.5a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
