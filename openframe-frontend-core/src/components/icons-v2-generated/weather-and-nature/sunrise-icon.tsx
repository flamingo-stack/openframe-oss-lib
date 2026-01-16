import type { SVGProps } from "react";
export interface SunriseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SunriseIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SunriseIconProps) {
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
        d="M15.876 17a3.876 3.876 0 0 0-7.751 0 1.125 1.125 0 0 1-2.25 0 6.125 6.125 0 0 1 12.25 0 1.125 1.125 0 0 1-2.25 0ZM22 19.875l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005H2a1.125 1.125 0 0 1 0-2.25zm-18.5-4 .116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H2a1.125 1.125 0 0 1 0-2.25zm18.5 0 .115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-1.5a1.125 1.125 0 0 1 0-2.25zM4.133 9.134a1.126 1.126 0 0 1 1.506-.078l.086.078 1.06 1.06.077.085a1.125 1.125 0 0 1-1.582 1.584l-.085-.078-1.062-1.06-.076-.085a1.125 1.125 0 0 1 .076-1.506m14.143 0a1.125 1.125 0 1 1 1.59 1.59l-1.06 1.061a1.125 1.125 0 0 1-1.59-1.59zm-7.4-.634V4.716l-1.08 1.08a1.125 1.125 0 0 1-1.59-1.591l3-3 .17-.141a1.126 1.126 0 0 1 1.42.14l3 3 .076.086a1.125 1.125 0 0 1-1.582 1.583l-.085-.078-1.08-1.08V8.5l-.005.115a1.125 1.125 0 0 1-2.244-.115"
      />
    </svg>
  );
}
