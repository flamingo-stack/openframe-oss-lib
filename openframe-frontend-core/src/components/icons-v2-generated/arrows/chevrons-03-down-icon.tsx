import type { SVGProps } from "react";
export interface Chevrons03DownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevrons03DownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Chevrons03DownIconProps) {
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
        d="M17.204 12.205a1.125 1.125 0 1 1 1.591 1.59l-6 6c-.439.44-1.151.44-1.59 0l-6-6-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078L12 17.409z"
      />
      <path
        fill={color}
        d="M17.204 4.205a1.125 1.125 0 1 1 1.591 1.59l-6 6c-.439.44-1.151.44-1.59 0l-6-6-.078-.085A1.125 1.125 0 0 1 6.71 4.127l.085.078L12 9.409z"
      />
    </svg>
  );
}
