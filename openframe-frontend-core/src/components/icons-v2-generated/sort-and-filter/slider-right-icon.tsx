import type { SVGProps } from "react";
export interface SliderRightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SliderRightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SliderRightIconProps) {
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
        d="m12 10.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H2a1.125 1.125 0 0 1 0-2.25zm10 0 .115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-4a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M16.875 7.5a.375.375 0 0 0-.375-.375h-3a.375.375 0 0 0-.375.375v9c0 .207.168.375.375.375h3a.375.375 0 0 0 .375-.375zm2.25 9a2.625 2.625 0 0 1-2.625 2.625h-3a2.625 2.625 0 0 1-2.625-2.625v-9A2.625 2.625 0 0 1 13.5 4.875h3A2.625 2.625 0 0 1 19.125 7.5z"
      />
    </svg>
  );
}
