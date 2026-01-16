import type { SVGProps } from "react";
export interface Flip01RightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Flip01RightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Flip01RightIconProps) {
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
        d="M1.875 13.5A5.625 5.625 0 0 1 7.5 7.875H21l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H7.5a3.375 3.375 0 0 0 0 6.75H13l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H7.5A5.625 5.625 0 0 1 1.875 13.5"
      />
      <path
        fill={color}
        d="M16.205 13.795a1.125 1.125 0 0 0 1.505.078l.085-.078 4-4c.44-.44.44-1.152 0-1.591l-4-3.999a1.125 1.125 0 1 0-1.59 1.59l3.203 3.206-3.203 3.204-.078.085a1.125 1.125 0 0 0 .078 1.505"
      />
    </svg>
  );
}
