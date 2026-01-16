import type { SVGProps } from "react";
export interface EuroIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EuroIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: EuroIconProps) {
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
        d="M3.875 12C3.875 6.408 8.408 1.875 14 1.875c2.08 0 4.017.628 5.627 1.705a1.126 1.126 0 0 1-1.253 1.87 7.875 7.875 0 1 0 0 13.099 1.126 1.126 0 0 1 1.253 1.87A10.1 10.1 0 0 1 14 22.126C8.408 22.125 3.875 17.592 3.875 12"
      />
      <path
        fill={color}
        d="m14 12.876.115.005a1.125 1.125 0 0 1 0 2.239l-.116.006H3a1.125 1.125 0 0 1 0-2.25zm0-4.001.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H3a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
