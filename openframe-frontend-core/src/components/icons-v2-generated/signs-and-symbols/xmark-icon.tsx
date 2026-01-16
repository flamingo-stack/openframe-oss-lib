import type { SVGProps } from "react";
export interface XmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function XmarkIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: XmarkIconProps) {
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
        d="M17.205 5.205a1.125 1.125 0 1 1 1.59 1.59L13.591 12l5.205 5.204.077.085a1.125 1.125 0 0 1-1.583 1.584l-.085-.078L12 13.591l-5.205 5.204a1.125 1.125 0 1 1-1.59-1.59L10.409 12 5.205 6.795l-.078-.085A1.125 1.125 0 0 1 6.71 5.127l.085.078L12 10.409z"
      />
    </svg>
  );
}
