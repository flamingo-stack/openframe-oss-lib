import type { SVGProps } from "react";
export interface RadioIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RadioIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RadioIconProps) {
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
        d="M10.875 14a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m7.125.876.116.005a1.125 1.125 0 0 1 0 2.239l-.116.005h-2a1.125 1.125 0 0 1 0-2.25zm0-4.001.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-2a1.125 1.125 0 1 1 0-2.25zM7.503 8.007a1.125 1.125 0 0 1-1.006-2.013zm6.995-6.013a1.125 1.125 0 0 1 1.004 2.012l-8 4L7 7.002l-.503-1.007 8-4Zm-1.373 12.005a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0"
      />
      <path
        fill={color}
        d="M20.875 10c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zm2.25 8A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18v-8A4.125 4.125 0 0 1 5 5.875h14A4.125 4.125 0 0 1 23.125 10z"
      />
    </svg>
  );
}
