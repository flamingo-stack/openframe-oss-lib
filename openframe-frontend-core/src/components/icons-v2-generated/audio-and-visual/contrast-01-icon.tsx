import type { SVGProps } from "react";
export interface Contrast01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Contrast01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Contrast01IconProps) {
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
        d="M10.875 22V2a1.125 1.125 0 0 1 2.25 0v20a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.981 11.124-11.125 11.125S.875 18.145.875 12 5.855.875 12 .875s11.125 4.981 11.125 11.126Z"
      />
    </svg>
  );
}
