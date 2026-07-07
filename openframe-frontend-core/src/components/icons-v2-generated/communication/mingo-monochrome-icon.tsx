import type { SVGProps } from "react";
export interface MingoMonochromeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MingoMonochromeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MingoMonochromeIconProps) {
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
      <circle cx={8.875} cy={12} r={1.25} fill={color} />
      <circle cx={15.125} cy={12} r={1.25} fill={color} />
      <path
        fill={color}
        d="M2 8.25v7.5a3.75 3.75 0 0 0 3.75 3.75h8.75V17H5.75c-.69 0-1.25-.56-1.25-1.25v-7.5C4.5 7.56 5.06 7 5.75 7h12.5c.69 0 1.25.56 1.25 1.25V12H22V8.25a3.75 3.75 0 0 0-3.75-3.75H5.75A3.75 3.75 0 0 0 2 8.25"
      />
      <path fill={color} d="M17 19.5V17h2.5v-2.5H22v5z" />
    </svg>
  );
}
