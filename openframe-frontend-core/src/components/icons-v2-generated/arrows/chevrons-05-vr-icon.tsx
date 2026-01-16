import type { SVGProps } from "react";
export interface Chevrons05VrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevrons05VrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevrons05VrIconProps) {
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
        d="M17.204 14.205a1.125 1.125 0 1 1 1.591 1.59l-6 6c-.439.44-1.151.44-1.59 0l-6-6-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078L12 19.409zM11.29 2.127a1.125 1.125 0 0 1 1.505.078l6 6 .078.085a1.126 1.126 0 0 1-1.584 1.583l-.085-.078L12 4.591 6.795 9.795a1.125 1.125 0 1 1-1.59-1.59l6-6z"
      />
    </svg>
  );
}
