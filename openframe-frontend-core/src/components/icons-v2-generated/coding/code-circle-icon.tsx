import type { SVGProps } from "react";
export interface CodeCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodeCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CodeCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M9.205 8.955a1.125 1.125 0 1 1 1.59 1.59L9.341 12l1.454 1.455.078.085a1.125 1.125 0 0 1-1.583 1.583l-.085-.078-2.25-2.25a1.125 1.125 0 0 1 0-1.59zm4 0a1.125 1.125 0 0 1 1.505-.078l.086.078 2.25 2.25a1.126 1.126 0 0 1 0 1.59l-2.25 2.25a1.125 1.125 0 0 1-1.59-1.59L14.66 12l-1.455-1.455-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
