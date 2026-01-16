import type { SVGProps } from "react";
export interface Chevron02LeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevron02LeftIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevron02LeftIconProps) {
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
        d="M14.205 18.795a1.125 1.125 0 1 0 1.59-1.59L10.591 12l5.204-5.205.078-.085a1.125 1.125 0 0 0-1.583-1.583l-.085.078-6 6a1.125 1.125 0 0 0 0 1.59z"
      />
    </svg>
  );
}
