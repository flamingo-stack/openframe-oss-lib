import type { SVGProps } from "react";
export interface PoundIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PoundIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PoundIconProps) {
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
        d="M6.875 13.5c0-.804-.193-1.394-.45-2.231-.26-.845-.55-1.85-.55-3.27a6.125 6.125 0 0 1 11.74-2.449 1.125 1.125 0 1 1-2.061.9A3.877 3.877 0 0 0 8.125 8c0 1.08.21 1.827.45 2.607.242.787.55 1.697.55 2.893 0 1.674.002 3.841-1.196 6.375H17l.116.006a1.125 1.125 0 0 1 0 2.238l-.115.006H6a1.125 1.125 0 0 1-.936-1.749c1.806-2.71 1.81-4.923 1.81-6.876Z"
      />
      <path
        fill={color}
        d="m14 11.375.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H6a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
