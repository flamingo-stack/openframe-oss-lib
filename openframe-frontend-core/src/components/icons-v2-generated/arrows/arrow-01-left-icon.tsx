import type { SVGProps } from "react";
export interface Arrow01LeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Arrow01LeftIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Arrow01LeftIconProps) {
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
      <path
        fill={color}
        d="M10.205 5.205a1.125 1.125 0 1 1 1.59 1.59L6.591 12l5.204 5.205.078.085a1.125 1.125 0 0 1-1.583 1.583l-.085-.078-6-6a1.125 1.125 0 0 1 0-1.59z"
      />
    </svg>
  );
}
