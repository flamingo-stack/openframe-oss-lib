import type { SVGProps } from "react";
export interface MinusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MinusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MinusIconProps) {
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
        d="m19 10.875.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H5a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
