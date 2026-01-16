import type { SVGProps } from "react";
export interface TrafficConeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TrafficConeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TrafficConeIconProps) {
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
        d="m17.134 13.875.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H6.867a1.125 1.125 0 0 1 0-2.25zm-1.868-6 .116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H8.733a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M9.111 3.998c.882-2.835 4.896-2.835 5.778 0l4.94 15.877H21l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H3a1.125 1.125 0 0 1 0-2.25h1.172zm3.629.668c-.212-.681-1.129-.724-1.428-.128l-.052.128-4.731 15.21H17.47L12.74 4.665Z"
      />
    </svg>
  );
}
