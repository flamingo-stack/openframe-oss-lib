import type { SVGProps } from "react";
export interface Chevrons04VrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevrons04VrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevrons04VrIconProps) {
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
        d="M17.204 21.795a1.125 1.125 0 1 0 1.591-1.59l-6-6a1.125 1.125 0 0 0-1.59 0l-6 6-.078.085a1.126 1.126 0 0 0 1.583 1.583l.085-.078L12 16.591zM12 10.125c.298 0 .584-.119.795-.33l6-6 .078-.085a1.126 1.126 0 0 0-1.584-1.583l-.085.078L12 7.409 6.795 2.205a1.125 1.125 0 1 0-1.59 1.59l6 6 .17.141c.184.122.401.189.625.189"
      />
    </svg>
  );
}
