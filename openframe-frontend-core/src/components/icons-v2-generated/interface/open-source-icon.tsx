import type { SVGProps } from "react";
export interface OpenSourceIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function OpenSourceIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: OpenSourceIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 19 18"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M10.11 1.205a.938.938 0 0 1 1.805.5l-3.333 15a.939.939 0 0 1-1.831-.408l3.334-15zM4.503 4.17A.938.938 0 0 1 5.83 5.498L2.324 9l3.505 3.505.065.07a.938.938 0 0 1-1.319 1.319l-.072-.064L.337 9.663a.94.94 0 0 1 0-1.326zm8.334 0a.94.94 0 0 1 1.255-.064l.07.065 4.167 4.166a.937.937 0 0 1 0 1.326l-4.166 4.167a.938.938 0 0 1-1.326-1.325L16.34 9l-3.503-3.503-.065-.071a.94.94 0 0 1 .065-1.255"
      />
    </svg>
  );
}
