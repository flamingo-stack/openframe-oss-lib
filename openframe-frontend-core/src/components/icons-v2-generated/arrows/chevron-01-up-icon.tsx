import type { SVGProps } from "react";
export interface Chevron01UpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevron01UpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevron01UpIconProps) {
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
        d="M19.205 16.795a1.125 1.125 0 0 0 1.59-1.59l-8-8a1.125 1.125 0 0 0-1.591 0l-8 8-.077.085a1.126 1.126 0 0 0 1.583 1.583l.085-.078L12 9.591l7.206 7.204Z"
      />
    </svg>
  );
}
