import type { SVGProps } from "react";
export interface Chevron02UpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevron02UpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevron02UpIconProps) {
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
        d="M17.204 15.795a1.125 1.125 0 1 0 1.591-1.59l-6-6a1.125 1.125 0 0 0-1.59 0l-6 6-.078.085a1.126 1.126 0 0 0 1.583 1.583l.085-.078L12 10.591z"
      />
    </svg>
  );
}
